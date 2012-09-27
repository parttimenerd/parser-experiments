# Inspired by Russ Olsen (http://eloquentruby.com)

require File.dirname(__FILE__) + '/math-parser.rb'

print "> "
until $stdin.eof?
  line = STDIN.readline.strip.gsub("\e[A\e[B[.", '')
  break if line == "exit"
  puts MathParser.eval line
  print "> "
end