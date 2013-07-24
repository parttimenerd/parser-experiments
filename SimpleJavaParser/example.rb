require File.dirname(__FILE__) + '/simple_java_parser.rb'

parser = SimpleJavaParser.new
pp parser.parse(<<-JAVA
package abc;

import javax.*;
import static otherpackage.SomeClass.*;

/**
* This is my wonderful useless class...
**/
class WonderfulClass extends TestInnerClass implements ABC {
	
	private static String helloMsg = "Hello...";
	
	@Remove(why = "has an endless loop")
	static String getHelloMsg(){
		System.out.println(helloMsg);
		for (int i = 1; i++; i > 0){}
	}
	
	/** An inner class... Yeah... **/
	public abstract final class TestInnerClass {
		private abstract void hhm();
	}
}
JAVA
)