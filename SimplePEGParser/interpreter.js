/**
 * Implements an interpreter for a simple grammar definition
 * and returns a parser function.
 * 
 * @param peg_parser PEGParser object to work only
 * @param grammar grammar definition string
 * @return parser function that represents the grammar
 */
var Interpreter = (function(){
	with (require("./pegparser.js").parser()){
	//  console.log(exec(match_word("3"), "3"));
	/*	create_rule("a_rule", match_word("3"));
		create_rule("a_rule2", rule("a_rule"));
		create_rule("other", match_word("4"));
	console.log(exec(rule("a_rule"), "b"));
	console.log(exec(some(rule("a_rule2"), 5, 10), ""));
	console.log(exec(combine(rule("a_rule"), rule("a_rule2")), "3"));
		console.log(exec(or(rule("a_rule"), rule("other")), "4"));
		console.log(exec(not(rule("other")), "4"));	
		console.log(exec(end(), "4"));
		*/

		/* string literal, doesn't support '\'' or "\"" */
		rule("string", or(
			and(word('"'), without(word('"')), word('"')),
			and(word("'"), without(word("'")), word("'"))
			),
			function (value) {
				return value.substring(1, value.length - 1); 
			}
		);
		
		/* simple number, containing only numeric characters */
		rule("number", some(char_range("0", "9")), Number);
		
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
		
		rule("rule_name", some(or(char_range("a", "z"), char_range("A", "Z"))));
		
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
		rule("not", word("~"));
		
		/* composed term */
		rule("term", and(ws(), or(
				and(rule("term_part"), or(
					rule("any"), rule("some"), rule("not"), rule("times")
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
		
		//TODO write interpreter for grammar definitions
		
		var tree_rule_functions = {};
		
		/**
		* Process a program tree.
		*/
		tree_rule_functions.program = function(peg_parser, tree_obj){
			tree_helpers.extend({
				start_rule_def: [],
				rule_def: []
			}, tree_obj);
			if (start_rule_def.length == 0){
				throw "No start rule specified.";
			}
			
			// process the start rule definition
			tree_rule_functions.rule_def(peg_parser, tree_obj.start_rule_def);
			
			// process the other rule definition
			for (i = 0; i < tree_obj.rule_def.length; i++){
				tree_rule_functions.rule_def(peg_parser, tree_obj.rule_def[i]);
			}
			// get the name of the start rule 
			// and return an application function for this rule
			return peg_parser.rule(tree_obj.start_rule_def[0].rule_name[0].value);
		}
		
		/**
		* Process a rule definition tree.
		*/
		tree_rule_functions.rule_def = function(peg_parser, tree_obj){
			var rule_name = tree_obj.rule_name[0].value;
			if (rule_obj.term === undefined){
				throw "Rule " + rule_name + " has no associated term.";
			}
			peg_parser.rule(rule_name, 
				tree_rule_functions.term(peg_parser, tree_obj.term[0])
			);
		}
		
		/**
		* Process a term tree.
		*/
		tree_rule_functions.term = function(peg_parser, tree_obj){
			/*
			* "term", and(ws(), or(
			a nd(*rule("term_part"), or(
				rule("any"), rule("some"), rule("not"), rule("times")
				)),
				rule("term_part")
				),*/
		}
		
		/**
		* Process the passed rule tree.
		* 
		* Only works with normalized rule objects.
		* 
		* @return code
		*/
		function process(peg_parser, rule_name, tree_obj){
			if (tree_rule_functions[rule_name] === undefined){
				throw "No method for rule " + rule_name;
			}
			return tree_rule_functions[rule_name](peg_parser, tree_obj);
		}

		return function(pegparser, input){
			process(peg_parser, "program", exec(rule("program"), input))
		}
		
		//console.log(exec(rule("string"), "'augzgha'"));
		//console.log(exec(rule("number"), "9"));
		//console.log(exec(rule("char_range"), "9..9").rules.char_range);
	//	console.log(exec(rule("times"), "{98,  100}").rules.times);
	//  console.log(JSON.stringify(exec(rule("term"), "( #asdf #sdf){3, 2}"), undefined, 2));
	// 	console.log(exec(rule("term"), "( #asdf '3'..'3' ( #asdf '3'..'3' ){3, 2} ){3, 2} 'sdf'"));
	// 	console.log(exec(rule("comment"), " # \ŧ sdf"));
	// 	console.log(JSON.stringify(exec(rule("ws"), ")"), undefined, 2));
	// 	console.log(JSON.stringify(exec(rule("term_part"), "(#r #r )"), undefined, 2));
		//console.log(exec(rule("rule_def"), "ahhs =  (#sdf '9'..'9' (#sdf){4, 5})")); 
	console.log(((exec(rule("program"), "start abc = (#asdf #adfg (#abc | #a) | #asdf )"))).rules.program);
	// 	console.log(exec(rule("program"), "asdf = (#dsf #edg (#sdf){4, 4})"));
	}
}
)();

if (module !== undefined){
	module.exports = Interpreter;
}
