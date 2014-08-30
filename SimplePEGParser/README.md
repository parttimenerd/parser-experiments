SimplePEGParser
=================
A simple PEG parser written in JavaScript, inspired by parslet.

Features
--------------------
- produces a simple parser tree (like parslet)
- consists of (mostly) independent functions with minimal shared state

What it's not
--------------------
- performant – it's an experiment
- featurefull

Concepts
--------------------

A basic parsing function.
```js
function _func(input, next_char, helpers, func specific arguments){
	// do some stuff, update next_char, call rules, ...
	return {
		current_val: [value matched by this function],
		next_char  : next_char + [value matched ...].length
		error_stack: [...], // if an error occurred
		rules      : {}
	}
}
/*
Parameters:
input      : string of code to be parsed 
next_char  : position of the next character in the passed string
current_val: current value of the current rule application (that encloses this matching function)
helpers    : object containing helper functions
Return object:
current_val: current_val + chars matched by this function
next_char  : (see above)
error_stack:
	if this function does match: empty array
	else: if a neccessary called function doesn't match, set error_stack to the error_stack returned by this function.
Then append your own error object `{next_char: next_char, msg: "..."}`.
rules      :
- rule object:
{
	value    : current_val, 
	rule_abc : rule object or array if more than one rule objects,
	...
}
- the rule function (for rule A) creates a new rule object:
{
	value : current_val,
	A     : rule object normally returned by this function if it wasn't a rule
}
- a non rule function returns a combination of the rule object returned by the called functions. If a rule object (identified by the rule name) exists more than once, the rule object are moved into an array. (The rule name is then mapped to this array)
*/
```

It's wrapped for non-internal use.
```js
function func(arguments, ...){
	return function(basic func args with out _func specific args){
		return _func(_func specific args, basic func args);
	};
}
```
The most common functions have short aliases.


The set of matching functions can be seperated into several classes:
- base functions that match against a set of words
- combinator functions that combine several matching functions to one
- rule function that defines a rule

###Base functions
Described by a simple version of `match_word`.
```js
function _match_word(input, next_char, helpers, word){
	isCorrect = false;
	value = "";
	if (input.length - next_char <= word.length){ // match the input against the passed word
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
	return_obj = {
		current_val: value,
		next_char  : next_char + value.length,
		error_stack: [],
		rules      : {}
	}
	if (!isCorrect){
		helpers.appendError(return_obj, word);
	}
	return return_obj;
}
```

TODO
-----------------------
- Update README
