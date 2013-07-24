Simple Java Parser
============
This is just a really simple Java parser written in Ruby using [Parslet](http://kschiess.github.io/parslet/).
It can't parse the whole Java syntax, but is able to parse the overall structure of a Java file.
It parses the class, method and variable definition lines and combines them with the code that it can't parse and returns it as a native ruby hash.

It tries to parse some simple native types and can not parse every Java file properly - so be careful and don't use it to check Java files, as it will recognize far more as Java than the Java compiler does.


Okay, it's not really a Java parser, but it's enough to get the methods and instance variables of a class. And that's the purpose of this parser. It'll be used in a tiny code generator for on of my current projects.

Why Parslet and Ruby?
----------------
There are tons of other parser generators and peg parsers out there, so why do I use Parslet and Ruby?
- I like ruby
- I like the idea of Parslet using only pure ruby to describe the grammar

Usage
----------------
Check out the examples.rb file, to see how you can use the parser.


Example
----------------
```java
package abc;

import javax.*;
import static otherpackage.SomeClass.*;

/**
* This is my wonderfully useless class...
**/
class WonderfulClass extends TestInnerClass implements ABC {
	
	private static String helloMsg = "Hello...";
	
	@Remove(why = "has an endless loop")
	static String getHelloMsg(){
		System.out.println(helloMsg);
		for (int i = 1; i++; i > 0){}
	}
	
	/** An inner class... Yeah... **/
	public abstract class TestInnerClass {
		private abstract void hhm();
	}
}
```
becomes to
```ruby
{:package=>"abc"@8,
 :imports=>
  [{:import=>"javax.*"@21}, {:import_static=>"otherpackage.SomeClass.*"@44}],
 :class_or_interface=>
  {:comment=>
    {:text=>[{:text_line=>"This is my wonderfully useless class..."@77}]},
   :class=>
    [{:name=>"WonderfulClass"@125,
      :extends=>{:classes=>{:class=>"TestInnerClass"@148}},
      :implements=>{:classes=>{:class=>"ABC"@174}}},
     {:variable_definition=>
       {:annotations=>[],
        :visibility=>"private"@183,
        :static=>"static"@191,
        :type=>"String"@198,
        :name=>"helloMsg"@205,
        :value=>{:string=>"Hello..."@217}}},
     {:method_definition=>
       {:annotations=>
         [{:annotation=>
            {:name=>"Remove"@232,
             :arguments=>
              {:argument=>{:value=>{:string=>"has an endless loop"@246}}}}}],
        :static=>"static"@269,
        :type=>"String"@276,
        :name=>"getHelloMsg"@283,
        :method_body=>
         "\t\tSystem.out.println(helloMsg);\n\t\tfor (int i = 1; i++; i > 0){}\n\t"@298}},
     {:inner_class=>
       [{:comment=>{:text=>[{:text_line=>"An inner class... Yeah..."@372}]},
         :annotations=>[],
         :visibility=>"public"@403},
        {:abstract=>"abstract"@410},
        {:final=>"final"@419},
        {:class=>
          [{:name=>"TestInnerClass"@431},
           {:method_definition=>
             [{:annotations=>[]},
              {:visibility=>"private"@450},
              {:abstract=>"abstract"@458},
              {:type=>"void"@467},
              {:name=>"hhm"@472},
              {:none=>";"@477}]}]}]}]}}
```

TODO
----------------
- support enums
- parse more of the Java code currently tagged as :code
