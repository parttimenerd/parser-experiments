#math-parser

A simple parser for simple arythmetic expressions like ```ruby 4 * (4! + 4) ^ 2```.

See the math-parser.rb file for implementation details.

It has also an tiny REPL.

## Embedded usage

###Educational usage
```ruby
lex = MathParser::LexerParser.new
lex.lex "4.0*5"
#output parse tree
lex.parseLexerTokens.print
#output eval output
puts lex.start_token.eval true
```
###Normal usage
```ruby
result = MathParser.eval "3!"
```

## REPL usage

In your shell use Ruby 1.9.2 to run the REPL:

```sh
	ruby repl.rb
```

You'll then see a prompt:

    >
	
Start typing a mathematical expression and hit enter to evaluate it. To close the REPL type ```exit```.