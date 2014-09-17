
/*
 * A simple peg parser for JavaScript, inspired by parslet.
 *
 * (c) Johannes Bechberger, GNU GPL v3 licenced
 * 
 * It currently supports the following operations:
 * - match_word/word
 * - char_range
 * - lnbrk (linebreak)
 * - end
 * - without
 * - not
 * - times_range (`{min, max}` in regular expressions)
 * - any
 * - combine/and
 * - fork/or
 * - create_rule
 * - rule (apply a rule)
 */

var PEGParser = function(){
	var PEGParser = {
		helpers: {
			add_error: function(memo, return_obj, expected){
				var input_position = PEGParser.helpers.get_input_position(
					memo, return_obj.next_char
				);
				return_obj.error_stack.push({
					next_char: return_obj.next_char,
					input_position: input_position,
					expected : expected,
					actual   : return_obj.value 
				});
			},
			merge_rules: function(_rules, new_rules, used_rules){
// 				console.log(used_rules, _rules, new_rules);
				var rules = _rules;
				for (var rule in used_rules){
					var rule_number = used_rules[rule];
					if (new_rules[rule] === undefined && rules[rule] === undefined){
						rules[rule] = PEGParser.nil;            //rule hasn't been called
					} else if (new_rules[rule] !== undefined){
// 						console.log("----", rules[rule], new_rules[rule]);
						if (rules[rule] === undefined || rules[rule] === PEGParser.nil){
							if (rule_number <= 1 || new_rules[rule] instanceof Array){
								rules[rule] = new_rules[rule];
							} else {
								rules[rule] = [new_rules[rule]];
							}
						} else if (rules[rule] instanceof Array){
							
							if (new_rules[rule] instanceof Array){
								rules[rule].concat(new_rules[rule]);								
							} else {
								
								rules[rule].push(new_rules[rule]);
// 								console.log(rules[rule]);
							}
						} else {
							rules[rule] = [rules[rule], new_rules[rule]];
						}
// 						console.log(rules[rule]);
					}
				}
//  				console.log(rules);
				return rules;
			},
			memoize: function(memo, next_char, tag, return_obj){
				if (memo.rules === undefined){
					memo.rules = {};
				}
				if (memo.rules[tag] === undefined){
					memo.rules[tag] = {};
				}
				memo.rules[tag][next_char] = return_obj;
			},
			is_memoized: function(memo, next_char, tag){
				return memo !== undefined &&
					memo.rules !== undefined &&
					memo.rules[tag] !== undefined  && 
					memo.rules[tag][next_char] !== undefined;
			},
			get_memoized: function(memo, next_char, tag){
				if (this.is_memoized(memo, next_char, tag)){
					return memo.rules[tag][next_char];
				}
				return undefined;
			},
			add_linebreak: function(memo, next_char){
				if (memo.lines === undefined){
					memo.lines = {
						linebreak_chars: [next_char],
						max_line: 1
					};
				} else {
					var line = PEGParser.helpers.get_input_position(memo, next_char).line;
					if (line > memo.lines.max_line){
						memo.lines.max_line = line;
						memo.lines.linebreak_chars.push(next_char);
					}
				}
			},
			get_input_position: function(memo, next_char){
				if (memo.lines === undefined){
					return {
						line: 0,
						char: next_char
					};
				}
				var find_char = next_char;
				var chars = memo.lines.linebreak_chars;
				if (chars.length == 0){
					return {
						line: 1,
						char: next_char
					};
				}
				if (find_char >= chars[chars.length - 1]){
					return {
						line: chars.length + 1,
						char: next_char - chars[chars.length - 1]
					}
				}
				// binary search algorithm
				var mid;
				low = 0;
				high = chars.length - 1;
				while(low <= high) {
					mid = low + (high - low >> 1);
					if(chars[mid] < find_char){
						low = mid + 1;
					} else if(chars[mid] > find_char){
						high = mid - 1;
					} else {
						low = mid;
						break;
					}
				}
				var line = low + 1;
				var char = next_char;
				if (line > 1){
					char = next_char - chars[line - 2];
				}
				return {
					line: line,
					char: char
				};
			},
			init_line_numbers: function(memo, input){
				if (memo.lines === undefined){
					var linebreaks = [];
					var max_line = 1;
					for (var i = 0; i < input.length; i++){
						if (input.charAt(i) == "\n"){
							linebreaks.push(i + 1);
							max_line++;
						}
					}
					memo.lines = {
						linebreak_chars: linebreaks,
						max_line: max_line
					};
				}
			}
		},
		tree_helpers: {},
		rules: {},
		nil: [] //just like undefined or null but with the property length
	};
	
	var test_memo = {
		lines: {
			linebreak_chars: [2, 5, 8],
			max_line: 0
		}
	}
	/*var test_arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
	for (var i = 0; i < test_arr.length; i++){
		console.log("Line of char " + test_arr[i] + ": ",
					PEGParser.helpers.get_input_position(test_memo, test_arr[i]));
	}*/
	
	/**
	 * General notes for the following function that create parse functions:
	 * 
	 * They return an object:
	 * ```
	 *	{
	 * 		func: function(input, next_char, memo),
	 * 		rules: {...}
	 * 	}
	 * ```
	 * 
	 * `func` is the parse function, that gets the input string,
	 * the index of the char to be examined next and memo object used for caching
	 * rule invokations. It returns a parse object.
	 * 
	 * `rules` is an object containing the rules that are used in the parse function
	 * itself or in parse functions called by this parse function (and added to the
	 * rule tree).
	 * It has the following structure:
	 * ```
	 * 	{
	 * 		RULE: [number of times RULE is called, esp. 1 or > 1],
	 * 		...
	 * 	}
	 * ```
	 * An exepction is the `rules` object returned by rule functions:
	 * ```
	 * 	{
	 * 		RULE_NAME: 1
	 * 	}
	 * ```
	 * It's used to build a proper tree structure (that doesn't depend on the actual input
	 * and is therefore deterministic).
	 * 
	 * The method comments only describes `func`.
	 */
	
	/**
	 * Returns a parse function that matches the input against 
	 * the given word.
	 *
	 * @param word given word string
	 * @return parse function
	 */
	PEGParser.match_word = function(word){
		var parser = this;
		return {
			func: function(input, next_char, memo){
				parser.helpers.init_line_numbers(memo, input);
				var isCorrect = false;
				var value = ""; 
				if (input.length - next_char >= word.length){ // match the input against the passed word
					isCorrect = true;
					for (i = 0; i < word.length; i++){
						input_char = input.charAt(next_char + i); 
						value += input_char;
						if (input_char != word.charAt(i)){
							isCorrect = false;
							break;
						}
					}
				}   
				var return_obj = { 
					value      : value,
					next_char  : next_char + value.length,
					error_stack: [], 
					rules      : {}
				}   
				if (!isCorrect){
					parser.helpers.add_error(memo, return_obj, word);
				}                                                                 
				return return_obj;
			},
			rules: {} //affected rules, rules probably called sometime while executing the parse func
		}
	}
	
	/**
	 * Returns a parse function that matches the input against 
	 * the given word.
	 * Alias for the match_word function.
	 *
	 * @param word given word string
	 * @return parse function
	 */
	PEGParser.word = PEGParser.match_word;
	
	/**
	 * Returns a function that matches a single char that is lexicographically
	 * between (or equals) the start_char and the end_char.
	 */
	PEGParser.char_range = function(start_char, end_char){
		var parser = this;
		if (start_char.length != 1 || end_char.length != 1){
			throw "char_range expects single chars as input";
		}
		return {
			func: function(input, next_char, memo){
				parser.helpers.init_line_numbers(memo, input);
				char = input.charAt(next_char);
				var return_obj = { 
					value      : char,
					next_char  : next_char + 1,
					error_stack: [], 
					rules      : {}
				}  
				//  		console.log("Test " + char + start_char + end_char);
				if (start_char.localeCompare(char) >= 1 || end_char.localeCompare(char) <= -1){
					// 			console.log("true");
					parser.helpers.add_error(memo, return_obj, "[" + start_char + end_char + "]");
				}      
				// 		console.log(return_obj);
				return return_obj;
			},
			rules: {}
		}
	}
	
	/**
	 * Returns a parse function that checks for the end 
	 * of the input string.
	 *
	 * @return parse function
	 */
	PEGParser.end = function(){
		parser = this;
		return {
			func: function(input, next_char, memo){
				var return_obj = {
					value: "",
					next_char: next_char + 1,
					rules: {},
					error_stack: []
				};
				if (input.length > next_char){
					return_obj.value = input.charAt(input.length - 1);
					parser.helpers.add_error(memo, return_obj, "[end of input]");
				}
				return return_obj;		
			},
			rules: {}
		};
	}
	
	/**
	 * Returns a parse function that checks a linebreak.
	 *
	 * @return parse function
	 */
	PEGParser.lbrk = function(){
		return PEGParser.and(
			PEGParser.any(PEGParser.word("\r")), PEGParser.word("\n")
		);
	}
	
	/**
	 * Returns a parse function that matches any whitespace (and tabs).
	 *
	 * @param min_number minimum number of whitespace characters, 0 if ommitted
	 * @return parse function
	 */
	PEGParser.ws = function(min_number){
		if (min_number === undefined){
			min_number = 0;
		}
		return PEGParser.times_range(PEGParser.or(
				PEGParser.word(" "), PEGParser.word("\t")
			), min_number, Infinity);
	}
	
	/**
	 * Returns a function that matches the char, that doesn't begin
	 * a string matched by the given parsing function.
	 * 
	 * @param func_obj given parsing function object
	 */
	PEGParser.not = function(func_obj){
		var parser = this;
		var parse_func = func_obj.func;
		return {
			func: function(input, next_char, memo){
				var return_obj = {
					value: "",
					next_char: next_char + 1,
					rules: {},
					error_stack: []
				};
				if (input.length > next_char){
					var res = parse_func(input, next_char, memo);
					return_obj.value = res.value;
					//it's expected that the called function fails
					if (res.error_stack.length > 0){
						return_obj.value = input.charAt(next_char);
						return return_obj;
					} else {
						parser.helpers.add_error(memo, return_obj,
							"[not '" + res.value + "']"
						);
					}
				} else {
					parser.helpers.add_error(memo, return_obj, "[a char]");
				}
				return return_obj;
			},
			rules: {}
		};
	}
	
	/**
	 * Returns a function that matches the string, that doesn't 
	 * contain a string matched by the given parsing function.
	 * Alias for the without function. 
	 * 
	 * @param parse_func given parsing function
	 */
	PEGParser.without = function(parse_func){
		return PEGParser.any(PEGParser.not(parse_func));
	}
	
	/**
	 * Returns a parse function that matches the given parse function
	 * min to max times against the input.
	 * Comparable to using `{min, max}` in a regular expression.
	 *
	 * @param min minimum times the given function has to match
	 * @param max maximum times the given function has to match
	 */
	PEGParser.times_range = function(func_obj, min, max){
		var parser = this;
		var parse_func = func_obj.func;
		var used_rules = {};
		for (var key in func_obj.rules){
			used_rules[key] = 2;
		}
		return {
			func: function(input, next_char, memo){
				var return_obj = {
					value: "",
					next_char: next_char,
					rules: {},
					error_stack: []
				};
				var last_return_obj = return_obj;
				for (i = 0; i < max; i++){
					var res = parse_func(input, return_obj.next_char, memo);
					return_obj = {
						next_char: res.next_char,
						value: return_obj.value + res.value,
						rules: last_return_obj.rules,
						error_stack: []
					};

// 	console.log("+++", res);			
// 					console.log("++++++++", return_obj.rules);
					if (res.error_stack.length > 0){
						if (i < min){
							return_obj.error_stack = res.error_stack;
							parser.helpers.add_error(memo, return_obj,
								min + " times or more"
							);
							return return_obj;
						}
//  						console.log("####", last_return_obj);
						return last_return_obj;
					} else {
						parser.helpers.merge_rules(return_obj.rules, res.rules, used_rules);
						last_return_obj = return_obj;
					}
				} 
				return last_return_obj;
			},
			rules: used_rules
		}
	}
	
	/**
	 * Alias for times_range(parse_func, 0, "Infinity")
	 */
	PEGParser.any = function(parse_func){
		return this.times_range(parse_func, 0, "Infinity");
	}
	
	/**
	 * Alias for times_range(parse_func, 1, "Infinity")
	 */
	PEGParser.some = function(parse_func){
		return this.times_range(parse_func, 1, "Infinity");
	}
	
	/**
	 * Joins the passed parsing functions to one.
	 * Works with every number of parsing function as arguments.
	 * 
	 * @param parse_func parsing function
	 * @return resulting parsing function
	 */
	PEGParser.combine = function(parse_func){
		var parser = this;
		var args = [];
		var used_rules = {};
		for (var arg_index in arguments){
			arg_obj = arguments[arg_index];
			args.push(arg_obj.func);
			for (var used_rule in arg_obj.rules){
				used_number = arg_obj.rules[used_rule];
				used_rules[used_rule] = (used_rules[used_rule] || 0) + used_number;
			}
		}
		return {
			func: function(input, next_char, memo){
				var return_obj = {
					value: "",
					next_char: next_char,
					rules: {},
					error_stack: []
				};
				for (var arg_index in args){
					var arg = args[arg_index];
					var res = arg(input, return_obj.next_char, memo);
					return_obj.next_char = res.next_char;
					return_obj.value += res.value;
					parser.helpers.merge_rules(return_obj.rules, res.rules, used_rules);
					if (res.error_stack.length > 0){
						return_obj.error_stack = res.error_stack;
						var expected = return_obj.value;
						expected += res.error_stack[res.error_stack.length - 1].expected;
						parser.helpers.add_error(memo, return_obj, expected);
						return return_obj;
					}
				}                                                             
				return return_obj;
			},
			rules: used_rules
		};
	}
	
	/**
	 * Joins the passed parsing functions to one.
	 * Works with every number of parsing function as arguments.
	 * Alias for the combine function.
	 * 
	 * @param parse_func parsing function
	 * @return resulting parsing function
	 */
	PEGParser.and = PEGParser.combine;
	
	/**
	 * Joins the passed parsing functions to one by or-ring them.
	 * Only one of passed functions has to match.
	 * The resulting functions returns the result of the first matching
	 * function.
	 * Works with every number of parsing function as arguments.
	 * 
	 * @param parse_func parsing function
	 * @return resulting parsing function
	 */
	PEGParser.or = function(parse_func){
		var parser = this;
		var args = [];
		var used_rules = {};
		for (var arg_index in arguments){
			arg_obj = arguments[arg_index];
			args.push(arg_obj.func);
			for (var used_rule in arg_obj.rules){
				used_number = arg_obj.rules[used_rule];
				used_rules[used_rule] = Math.max((used_rules[used_rule] || 0), used_number);
			}
		}
		return {
			func: function(input, next_char, memo){
				for (var arg_index in args){
					var arg = args[arg_index];
					var res = arg(input, next_char, memo);
	// 				console.log(res);
					res_rules = parser.helpers.merge_rules({}, res.rules, used_rules);
					res.rules = res_rules;
					if (res.error_stack.length > 0){
						if (arg_index == args.length - 1){
	// 						console.log("........", res);
							return res;
						}
					} else {
						return res;
					}
				}                                                             
				return {
					value: "",
					next_char: next_char,
					rules: {},
					error_stack: []
				};
			},
			rules: used_rules
		};
	}
	
	/**
	 * Joins the passed parsing functions to one by or-ring them.
	 * Only one of passed functions has to match.
	 * The resulting functions returns the result of the first matching
	 * function.
	 * Works with every number of parsing function as arguments.
	 * 
	 * Alias for `or`.
	 * 
	 * @param parse_func parsing function
	 * @return resulting parsing function
	 */
	PEGParser.fork = PEGParser.or;
		
	
	/**
	 * Creates a rule function of the given parse function.
	 * 
	 * Name should't be 'value', 'next_char', 'error_stack' or  'rules'.
	 * 
	 * @param name rule name
	 * @param func_obj parse function object
	 * @param rewrite_func (optional) function that gets the string result of parse_func
	 *                     and returns the extracted information, e.g. return a number
	 *                     for a numeric expression
	 */
	PEGParser.create_rule = function(name, func_obj, rewrite_func){
		var parser = this;
		if (this.rules[name] !== undefined){
			throw "Rule " + name + " already exists";
		}
		var parse_func = func_obj.func;
		this.rules[name] = {
			func: function(input, next_char, memo){
				var memo_tag = name;
				if (parser.helpers.is_memoized(memo, next_char, memo_tag)){
					return parser.helpers.get_memoized(memo, next_char, memo_tag);
				}
				var res_obj = parse_func(input, next_char, memo);
				var return_obj = {
					value      : res_obj.value,
					next_char  : res_obj.next_char,
					error_stack: res_obj.error_stack,
					rules      : {}
				}
				return_obj.rules[name] = res_obj.rules;
				var val = res_obj.value;
				if (rewrite_func !== undefined && res_obj.error_stack.length == 0){
					val = rewrite_func(val);
				}
				return_obj.rules[name].value = val;
				if (res_obj.error_stack.length > 0){
					parser.helpers.add_error(memo, return_obj, 
						"[Rule " + name + "]"
					);
				}
				parser.helpers.memoize(memo, next_char, memo_tag, return_obj);
				return return_obj;
			},
			rules: function(){ 
				var obj = {}; 
				obj[name] = 1; 
				return obj;
			}()
		}
	}
	
	/*
	 * Returns the function belonging to the named rule.
	 * Throws an exception, if the rule doesn't exist.
	 *
	 * @param name rule name
	 * @return function belonging to the named rule
	 */
	PEGParser._rule = function(name){
		if (this.rules[name] === undefined){
			throw "No such rule " + name;
		}
		return this.rules[name];
	}
	
	/*
	 * Returns a function that delegates the parsing
	 * to the rule with the given name.
	 * Throws an exception, if the rule doesn't exist.
	 * It's a lazy wrapper around the _rule function.
	 * If in doubt, use this function.
	 *
	 * It calls the create_rule function if more than one argument
	 * is passed, e.g. `rule("abc", word("as"))`.
	 *
	 * Name should't be 'value'.
	 *
	 * @param name rule name
	 * @return result of the rule
	 */
	PEGParser.rule = function(name){
		var parser = this;
		if (arguments.length == 1){
			return {
				func: function(input, next_char, memo){
					return parser._rule(name).func(input, next_char, memo);
				},
				rules: function(){
					var obj = {};
					obj[name] = 1;
					return obj;
				}()
			}
		} else {
			return parser.create_rule.apply(this, [].slice.apply(arguments));
		}
	}
	
	/**
	 * Execute the given match function with the given input string.
	 * @param func_obj given match function object
	 * @param input given input string to be parsed
	 * @result resulting parse tree like object
	 */
	PEGParser.exec = function(func_obj, input){
		if (input === undefined){
			throw "exec called without input string";
		}
		return func_obj.func(input, 0, {});
	}
	
	return PEGParser;
}

var tree_helpers = {};

tree_helpers.has_error = function(exec_result){
	return exec_result.error_stack.length > 0;
}

tree_helpers.is_leaf = function(sub_tree){
	if (sub_tree instanceof Array || tree_helpers.is_nil_node(sub_tree)){
		return false;
	}
	// has only a value property => is leaf
	return sub_tree.value !== undefined && Object.keys(sub_tree).length == 1;
}

tree_helpers.is_nil_node = function(node){
	return node == {} || node == [] ||
		   node === undefined || node.length === 0;
}

/**
 * @param func function(rule_name, rule_node, memo)
 * @param pass_array (default: false)
 */
tree_helpers.traverse = function(tree, func, memo, pass_array){
	if (pass_array === undefined){
		pass_array = false;
	}
	if (tree_helpers.is_nil_node(tree) || tree_helpers.is_leaf(tree)){
		return;
	}
	if (tree.rules && tree.value && tree.error_stack && tree.next_char){
		return tree_helpers.traverse(tree.rules, pass_array);
	}
	for (var rule_name in tree){
		
		if (rule_name == "value" || tree_helpers.is_nil_node(tree[rule_name])){
			continue;
		}
		if (tree[rule_name] instanceof Array){
			var children = tree[rule_name];
			if (!pass_array){
				for (var i = 0; i < children.length; i++){
					func(rule_name, children[i], memo);
				}
			} else {
				var arr = [];
				for (var i = 0; i < children.length; i++){
					if (!tree_helpers.is_nil_node(children[i])){
						arr.push(children[i]);						
					}
				}
				if (arr.length > 0){
					func(rule_name, arr, memo);
				}
			}
		} else {
			func(rule_name, tree[rule_name], memo);
		}		
	}
	return memo;
}

/**
 * Traverses all nodes recursively.
 * 
 * @param func function(rule_name, rule_node, memo)
 * @param a_priori (default: true)
 */
tree_helpers.traverse_recursively = function(tree, func, memo, a_priori){
	if (a_priori === undefined){
		a_priori = true;
	}
	var traverse_func = function(rule_name, rule_node, memo){
		if (a_priori){
			func(rule_name, rule_node, memo);
		}
		tree_helpers.traverse(rule_node, traverse_func, memo, a_priori);
		if (!a_priori){
			func(rule_name, rule_node, memo);
		}
	}
	return tree_helpers.traverse(tree, traverse_func, memo);
}

/**
 * Creates a string representation of the passed tree.
 * 
 * @param tree tree structure
 * @param indentation (default: 2)
 * @param all_values add also the matched strings for non leaf nodes?
 * 							(default: false)
 */
tree_helpers.stringify = function(tree, indentation, all_values){
	indentation = indentation || 2;
	if (all_values === undefined){
		all_values = false;
	}
	if (tree.rules && tree.value && tree.error_stack && tree.next_char){
		var str = "";
		if (tree.error_stack.length != 0){
			str += stringify_error_stack(tree.error_stack, 0, indentation);
		} else {
			str = "Tree\n----------\n";
			str += stringify_rules_tree(tree.rules, indentation,
									indentation, all_values);
		}
		return str;
	} else {
		return stringify_rules_tree(tree, 0, indentation, all_values);
	}
}

var stringify_rules_tree = function(rule_tree, indentation, ind_incr, all_values){
	var memo = {
		indentation: indentation
	}
//  	console.log(JSON.stringify(rule_tree, undefined, 2));
	var str = "";
	var func = function(rule_name, rule_node, memo){
		if (rule_node instanceof Array){
			str += indent(rule_name, memo.indentation) + "\n";
			for (var i = 0; i < rule_node.length; i++){
				var node = rule_node[i];
				if (tree_helpers.is_nil_node(node)){
					continue;
				}
				str += indent("- ", memo.indentation + ind_incr);
				if (all_values || tree_helpers.is_leaf(node)){
					str += JSON.stringify(node.value);
				}
				str += "\n";
				memo.indentation += ind_incr * 2;
//  				console.log("####", node);
 				tree_helpers.traverse(node, func, memo, true);
				memo.indentation -= ind_incr * 2;
			}
		} else {
			str += indent(rule_name, memo.indentation);
			if (all_values || tree_helpers.is_leaf(rule_node)){
				str += ": " + JSON.stringify(rule_node.value);
			}
			str += "\n";
			memo.indentation += ind_incr;
			tree_helpers.traverse(rule_node, func, memo, true);
			memo.indentation -= ind_incr;
		}
	}
	tree_helpers.traverse(rule_tree, func, memo, true);
	return str;
}

var stringify_error_stack = function(error_stack, indentation, ind_incr){
	var str_arr = [];
	if (error_stack.length > 0){
		var first = error_stack[0];
		var pos = first.input_position
		str_arr[0] = indent(
			"Error at " + pos.line + "." + pos.char +
			": expected " + JSON.stringify(first.expected) + 
			" but got " + JSON.stringify(first.actual),
			indentation
		);
		for (var i = 1; i < error_stack.length; i++){
			var error = error_stack[i];
			var pos = error.input_position;
			str_arr.push(indent(
				"At " + pos.line + "." + pos.char +
				": expected " + JSON.stringify(error.expected) + 
				" but got " + JSON.stringify(error.actual),
				indentation + ind_incr	
			));
		}
	}
	return str_arr.join("\n");
}

var indent = function(string, identation){
	var str = "";
	for (i = 0; i < identation; i++){
		str += " ";
	}
	return str + string;
}

if (module !== undefined){
	module.exports = {
		parser: PEGParser,
		tree_helpers: tree_helpers
	}
}

var interpret = require("./interpreter.js");
if (module !== undefined){
	module.exports.interpret = interpret;
}