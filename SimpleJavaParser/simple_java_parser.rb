#Copyright 2013 Johannes Bechberger, MIT license

require 'parslet'
require 'pp'
require 'parslet/convenience'

#Simple java parser, able to parse the overall structure of most java files
class SimpleJavaParser < Parslet::Parser
	rule(:space)  { match('\s').repeat(1) }
	rule(:space?) { space.maybe }
	rule(:comma) { space? >> str(',') >> space? }
	
	#normal ID (e.g. used in method definitions as the variable name)
	rule(:id)        { match('[a-zA-Z0-9_]').repeat(1) }
	#serveral IDs clue together with dots (e.g. used in import statements)
	rule(:ids)       { id >> (str('.') >> id).repeat(0) }
	#type ID,  allowing the gernerics, annotation and array definition syntax, used for every Java type or class
	rule(:t_id)     { match('[a-zA-Z0-9_><@\[\]]').repeat(1) }
	#several type IDs clue together with dots to a full type
	rule(:type)    { id >> (str('.') >> t_id).repeat(0) }
	#Serveral comma seperated types (e.g. used in class definitions for the implements statement)
	rule(:type_list) { (type.as(:class) >> (comma >> type.as(:class)).repeat).as(:classes) }
	#line break (also consumes empty lines)
	rule(:lbr)      { (str("\n") | str("\r") | str("\r\n")).repeat(1) }
	rule(:lbr?)     { lbr.maybe }
	#end of code line
	rule(:line_end) { str(';') >> space? >> lbr? >> space? }
	#visibilty of a Java class, interface, variable, etc.
	rule(:visibility) { str('public') | str('private') | str('protected') }
	#keywords used in method and variable definitions like 'volatile' and 'transient'
	rule(:var_and_method_keywords){
		((str('volatile') | str('transient') |
		   str('synchronized') | str('abstract') |
		   str('final')).as(:prop) >> space?         ).repeat(0)
	}
	#single line comment
	rule(:single_comment) {space? >> str('//') >> (str("\n").absent? >> any).repeat}
	#multiline comment
	rule(:long_comment) {
		space? >> (str('/**') | str('/*')) >> space? >> lbr? >> (
		       long_comment_line
		).repeat.as(:text) >> (str('*/') | str('**/'))
	}
	#text line in long comment
	rule(:long_comment_line) {
		(str('*/') | str('**/')).absent? >> ((str('*/') | str('**/') | (lbr? >> space? >> str('*') >> space?)).absent? >> any).repeat(1).as(:text_line).maybe >> (lbr? >> space? >> str('*') >> space?).maybe
	}
	#single line or long comment
	rule(:comment)  { space? >> (long_comment | single_comment) >> lbr? }
	rule(:comment?) { comment.maybe >> lbr? }
	
	#Just some data types I integrated just for fun (don't rely on them as they don't represent the Java spec)
	rule(:string)    { str('"') >> ((str('\"').absent? >> str('"')).absent? >> any).repeat.as(:string) >> str('"') }
	rule(:char)     { str("'") >> ((str('\"').absent? >> str("'")).absent? >> any).repeat.as(:char) >> str("'") }
	rule(:int)        { match('[0-9]').repeat(1) }
	rule(:double)   { int >> str('.') >> int }
	rule(:float)     { (double | int) >> str('f') }
	rule(:boolean) { str('true') | str('false') }
	rule(:null)       { str('null') }
	rule(:native_value) {
		int.as(:int) | double.as(:double) | float.as(:float) | string | char | boolean.as(:boolean) | null.as(:null)
	}
	
	#the base rule
	rule(:java_file) {
		comment? >> package >> comment? >> lbr? >> imports.maybe.as(:imports) >> lbr? >> (comment.repeat.maybe >> lbr).maybe >> class_r
	}
	
	#File header
	rule(:package) { str('package') >> space >> (ids >>  str('.*').maybe).as(:package) >> line_end }
	rule(:import)    { str('import') >> space >> (ids >> str('.*').maybe).as(:import) >> line_end }
	rule(:import_static) {
		str('import') >> space >> str('static') >> space >> (ids >>  str('.*').maybe).as(:import_static) >> line_end
	}
	rule(:imports)  { (import | import_static).repeat }
	
	#Class and interface definition with (maybe) leading comment and (probably) a visibility keyword and some other keywords
	rule(:class_r) {
		((long_comment.as(:comment) >> lbr?).maybe >> (visibility.as(:visibility) >> space).maybe >> (var_and_method_keywords.as(:prop) >> space).repeat.as(:props) >> class_wo_comment).as(:class_or_interface)
	}
	#Class and interface definition without a leading comment and leading keywords
	rule(:class_wo_comment) {
		(str('class') >> space >> t_id.as(:name) >> space? >> extends.maybe >> implements.maybe >> str('{') >> lbr? >> class_body >> lbr? >> str('}') >> lbr?).as(:class) |
		(str('interface') >> space >> t_id.as(:name) >> space? >> extends.maybe >> implements.maybe >> str('{') >> lbr? >> class_body >> lbr? >> str('}') >> lbr?).as(:interface) |
		(str('@interface') >> space >> t_id.as(:name) >> space? >> extends.maybe >> implements.maybe >> str('{') >> lbr? >> class_body >> lbr? >> str('}') >> lbr?).as(:annotation_interface)
	}
	rule(:extends)     { space? >> str('extends') >> space >> type_list.as(:extends) >> space? }
	rule(:implements) { space? >> str('implements') >> space >> type_list.as(:implements) >> space? }
	rule(:class_body) {
		(space? >> lbr? >> ((single_comment >> lbr) | inner_class | var_def | method_def | long_comment >> lbr)).repeat(0)
	}
	
	#variable definition, e.g. 'public static void main'
	rule(:var_def_start) {
		(visibility.as(:visibility) >> space).maybe >> (str('static').as(:static) >> space).maybe >> var_and_method_keywords.as(:props) >> space? >> type.as(:type) >> space? >>id.as(:name)
	}
	#comment? and annotation?
	rule(:def_pre) { (space? >> long_comment.as(:comment).maybe >> annotations? >> lbr?).maybe >> space? }
	rule(:var_def) {
		space? >> (def_pre >> var_def_start >> (space? >> str('=') >> space? >> value.as(:value)).maybe >> line_end >> lbr?
		                ).as(:variable_definition)
	}
	rule(:value) {
		native_value | code.as(:code)
	}
	rule(:method_def) {
		space? >> (def_pre >> var_def_start >> space? >> method_args >> throws.maybe >> space? >> lbr? >> space? >> (str('{') >> lbr? >> (code.as(:method_body) | str(';').as(:none)) >> lbr? >> space? >> str('}')  >> space? |
			str(';').as(:none) >> space) >> lbr?
		).as(:method_definition)
	}
	rule(:method_args) {
		(str('(') >> space? >> (method_arg.as(:argument) >> (comma >> method_arg.as(:argument)).repeat(0)).as(:arguments).maybe >> space? >> str(')'))
	}
	rule(:method_arg) {
		space >> (str('static').as(:static) >> space).maybe >> var_and_method_keywords.as(:props) >> space? >> type.as(:type) >> space? >> id.as(:name)
	}
	rule(:throws) {
		space? >> str('throws') >> space >> (type >> (comma >> type).repeat).as(:throws) >> space?
	}
	rule(:inner_class) {
		space? >> (def_pre >> (visibility.as(:visibility) >> space).maybe >> (str('static').as(:static) >> space).maybe >> var_and_method_keywords.as(:props) >> space? >> class_wo_comment).as(:inner_class)
	}
	rule(:annotations?) { annotation.repeat.as(:annotations) }
	rule(:annotation) {
		space? >> (str('@') >> id.as(:name) >> (str('(') >> (space? >> annotation_arg.as(:argument) >> (comma >> annotation_arg.as(:argument) >> space?).repeat).as(:arguments)>> str(')')).maybe).as(:annotation) >> lbr? 
	}
	rule(:annotation_arg) {
		id >> space? >> str('=') >> space? >> value.as(:value)
	}
	rule(:code) {
		space? >> lbr? >> space? >> wo_cbrackets >> (str('{') >> code >> str('}')).repeat >> space? >> lbr? >> space?
	}
	#text that doesn't contain curly brackets outside of strings
	rule(:wo_cbrackets) {
		(str('"') >> ((str('\"').absent? >> str('"')).absent? >> any).repeat >> str('"') |
		str("'") >> ((str("\'").absent? >> str("'")).absent? >> any).repeat >> str('"') |
		char | (str('{') | str('}')).absent? >> any).repeat
	}
	#left or right curly bracket
	rule(:lr_cbracket){str('{') | str('}')}
	
	root :java_file
end