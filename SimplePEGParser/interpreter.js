var PEGParser = require("./pegparser.js")
var create_parser = PEGParser.parser;
var tree_helpers = PEGParser.tree_helpers;

/**
 * Implements an interpreter for a simple grammar definition
 * and returns a parser function.
 * 
 * @param peg_parser PEGParser object to work only
 * @param grammar grammar definition string
 * @return parser function that represents the grammar
 */
var interpret = (function(){
	var parser = create_parser();
	with (parser){

		/* string literal, enclosed by '"' */
		rule("string", 
			 and(word('"'), any(or(
					word('\\"'),
					word("\\\\"),
					word("\\t"),
					word("\\r"),
					word("\\n"),
					not(word('"'))
				)), 
				word('"')
			),
			function (value) {
				var str = value.substring(1, value.length - 1);
				var replacements = { // 1: 2 => replace 1 for 2
					'\\"': '"', '\\"': '"',	"\\\\": "\\", 
					"\\r": "\r", "\\n": "\n", "\\t": "\t"
				}
				for (var match in replacements){
					str = str.replace(match, replacements[match]);
				}
				return str;
			}
		);
		
		/* simple number, containing only numeric characters */
		rule("number", or(some(char_range("0", "9")), word("Infinity")), Number);
		
		/* range expression, `"[start char]".."[end char]"` */
		rule("char_range", and(rule("string"), word(".."), rule("string")));
		
		/* times range expression `{[start number], [end number]}` */
		rule("times", and(
			word("{"), ws(), 
			rule("number"), 
			ws(), word(","), ws(), 
			rule("number"), 
			ws(), word("}")
		));
		
		rule("end", word("END"));
		
		rule("rule_name", and(
			or(char_range("a", "z"), char_range("A", "Z")),
			any(or(
				char_range("a", "z"), char_range("A", "Z"),
				char_range("0", "9"), word("_")
			))
		));
		
		rule("call_rule", and(word("#"), rule("rule_name")));
		
		/* whitespace shortcut */
		rule("ws", word("-"));
		
		rule("fork", or(
			and(ws(), rule("combine"), ws(), 
				any(and(word("|"), ws(), rule("combine"), ws()))
			)
		));
		
		rule("combine", any(and(ws(), rule("term"), ws())));
		
		/* part of a composed term */ 
		rule("term_part", and(ws(), or(
				and(word("("), ws(), rule("fork"), ws(), word(")")),
				rule("char_range"),
				rule("string"),
				rule("end"),
				rule("call_rule"),
				rule("ws")),
			ws())
		);
		
		rule("any", word("*"));
		rule("some", word("+"));
		rule("not", word("!"));
		rule("without", word("~"));
		
		/* composed term */
		rule("term", and(ws(), or(
				and(rule("term_part"), or(
					rule("any"), rule("some"), 
					rule("not"), rule("times"),
					rule("without")
				)),
				rule("term_part")
			),
			ws())
		);
		
		/* rule definition */
		rule("rule_def", and(
			ws(), rule("rule_name"), ws(), word("="), ws(), rule("term"), ws()
		));
		
		/* start rule definition */
		rule("start_rule_def", and(
			ws(), word("start"), ws(), rule("rule_name"), ws(), word("="), ws(), rule("term"), ws()
		));
		
		rule("comment", and(ws(), word("#"), ws(), without(lbrk())));
		
		rule("program", and(any(lbrk()), rule("start_rule_def"), any(
			and(or(
				lbrk(), 
				rule("comment"),
				rule("rule_def")
			), lbrk())		
		), end()));
	}
	
	var tree_helpers = PEGParser.tree_helpers;
	
	/**
	* Process a program tree.
	*/
	function program(peg_parser, tree_obj){
		// process the start rule definition
		rule_def(peg_parser, tree_obj.start_rule_def);
		
		// process the other rule definition
		for (i = 0; i < tree_obj.rule_def.length; i++){
			rule_def(peg_parser, tree_obj.rule_def[i]);
		}
		// get the name of the start rule 
		// and return an application function for this rule
		return peg_parser.rule(tree_obj.start_rule_def.rule_name.value);
	}
	
	/**
	* Process a rule definition tree.
	*/
	function rule_def(peg_parser, tree_obj){
		//console.log(tree_obj);
		var rule_name = tree_obj.rule_name.value;
		if (tree_obj.term === undefined){
			throw "Rule " + rule_name + " has no associated term.";
		}
		peg_parser.rule(rule_name, 
			term(peg_parser, tree_obj.term)
		);
	}
	
	/**
	* Process a term tree.
	*/
	function term(peg_parser, tree_obj){
		var _term_part = term_part(peg_parser, tree_obj.term_part);
		var possible_apps = ["any", "some", "not", "without"];
		for (var i = 0; i < possible_apps.length; i++){
			var app = possible_apps[i];
			if (tree_helpers.is_leaf(tree_obj[app])){
				return peg_parser[app](_term_part);
			}
		}
		if (!tree_helpers.is_nil_node(tree_obj.time)){
			var numbers = tree_obj.times.number;
			return peg_parser.times_range(_term_part, numbers[0], numbers[1]);
		}
		return _term_part;
	}
	
	/**
	 * Process a term_part tree.
	 */
	function term_part(peg_parser, tree_obj){
// 		console.log(tree_obj);
		var non_empty = "";
		for (var node_name in tree_obj){
			if (!tree_helpers.is_nil_node(tree_obj[node_name])){
				non_empty = node_name;
				break;
			}
		}
		var node = tree_obj[non_empty];
		switch (non_empty){
			case "fork":
				return fork(peg_parser, node);
			case "call_rule":
				return peg_parser.rule(node.rule_name.value);
			case "string":
				return peg_parser.word(node.value);
			case "end":
				return peg_parser.end();
			case "ws":
				return peg_parser.ws();
		}
		return peg_parser.word("");
	}
	
	/**
	 * Process a fork tree.
	 */
	function fork(peg_parser, tree_obj){
		var child_funcs = [];
		for (var i = 0; i < tree_obj.combine.length; i++){
			child_funcs.push(combine(peg_parser, tree_obj.combine[i]));
		}
		return peg_parser.or.apply(peg_parser, child_funcs);
	}
	
	/**
	 * Process a combine tree.
	 */
	function combine(peg_parser, tree_obj){
		var child_funcs = [];
		for (var i = 0; i < tree_obj.term.length; i++){
			child_funcs.push(term(peg_parser, tree_obj.term[i]));
		}
		return peg_parser.and.apply(peg_parser, child_funcs);
	}

//         console.log(PEGParser.tree_helpers.stringify(exec(rule("program"), "start a = ( - -)"), 2, true));
	
	return function(peg_parser, input){
		var res = parser.exec(parser.rule("program"), input);
		if (tree_helpers.has_error(res)){
			throw tree_helpers.stringify(res);
		}
// 		console.log(tree_helpers.stringify(res));
		return program(peg_parser, res.rules.program);
	}
		
}
)();

if (module !== undefined){
	module.exports = interpret;
}

/* Test the interpreter */
// var parser = create_parser();
// console.log(tree_helpers.stringify(parser.exec(interpret(parser, "start rule =  (\"a\" END)"), "b")));