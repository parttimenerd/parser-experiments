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


Example
----------------
```java
package abc;

import javax.*;
import static otherpackage.SomeClass.*;

/** 
* This is my wonderful useless class...
**/
class WonderfulClass {
	
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
 :class=>
  [{:comment=>{:text=>" \n* This is my wonderful useless class...\n"@74},
    :props=>[]},
   {:name=>"WonderfulClass"@126},
   {:variable_definition=>
     {:annotations=>[],
      :visibility=>"private"@146,
      :static=>"static"@154,
      :props=>[],
      :type=>"String"@161,
      :name=>"helloMsg"@168,
      :value=>{:string=>"Hello..."@180}}},
   {:method_definition=>
     {:annotations=>
       [{:annotation=>
          {:name=>"Remove"@195,
           :arguments=>
            {:argument=>{:value=>{:string=>"has an endless loop"@209}}}}}],
      :static=>"static"@232,
      :props=>[],
      :type=>"String"@239,
      :name=>"getHelloMsg"@246,
      :method_body=>
       "\t\tSystem.out.println(helloMsg);\n\t\tfor (int i = 1; i++; i > 0){}\n\t"@261}},
   {:inner_class=>
     [{:comment=>{:text=>" An inner class... Yeah... "@334},
       :annotations=>[],
       :visibility=>"public"@366,
       :props=>[{:prop=>"abstract"@373}]},
      {:name=>"TestInnerClass"@388},
      {:method_definition=>
        {:annotations=>[],
         :visibility=>"private"@407,
         :props=>[{:prop=>"abstract"@415}],
         :type=>"void"@424,
         :name=>"hhm"@429,
         :none=>";"@434}}]}]}
```

TODO
----------------
- support enums
- parse more of the Java code currently tagged as :code