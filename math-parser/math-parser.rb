module MathParser
	class LexerParser
		attr_reader :token_types, :lexer_tokens, :token_types_arr, :lexer_token_types_arr, :start_token
		
		def initialize
			@token_types = {
				:plus => {
					:value => "+",
					:left_leaf_action => lambda {|this, a| a.eval},
					:both_leafs_action => lambda {|this, a, b| a.eval + b.eval}
				},
				:minus => {
					:value => "-",
					:left_leaf_action => lambda {|this, a| -a.eval},
					:both_leafs_action => lambda {|this, a, b| a.eval - b.eval}
				},
				:mul => {
					:value => "*",
					:both_leafs_action => lambda {|this, a, b| a.eval * b.eval}
				},
				:div => {
					:value => "/",
					:both_leafs_action => lambda {|this, a, b| a.eval / b.eval}
				},
				:pow => {
					:value => "^",
					:both_leafs_action => lambda {|this, a, b| a.eval ** b.eval}
				},
				:factorial => {
					:value => "!",
					:left_leaf_action => lambda {|this, a| (1..a.eval).inject(:*) || 1}
				},
				:brackets => {
					:value => "()",
					:leaf_action => lambda {|this| this.value.eval }
				},
				:number => {
					:value => /[0-9]+(\.[0-9]*)?$/,
					:leaf_action => lambda {|this| this.value.to_f},
					:left_leaf_action => lambda {|a| a.eval},
					:right_leaf_action => lambda {|a| a.eval},
					:both_leafs_action => lambda {|a, b| a.eval + b.eval}
				},
				:lbracket => {
					:value => "("
				},
				:rbracket => {
					:value => ")"
				}
			}
			@token_types_arr = @token_types.keys
		end
		
		def lex(str)
			tokens = []
			token_types_arr = []
			token = nil
			i = 0
			while i < str.length
				last_token = token
				token = nil
				current = str[i].chr
				if current != " "
					@token_types.each do |type, hash|
						val = hash[:value]
						if val
							if val.is_a? Regexp
								s = current
								if s =~ val
									i += 1
									i.upto(str.length - 1) do |j|
										_s = s + str[j].chr
										if _s =~ val
											s = _s
										else
											break
										end
									end
									i += s.length - 1
									token = {:type => type, :hash => hash, :value => s}
									break
								end
							else
								if str[i...(i + val.length)] == val
									token = {:type => type, :hash => hash, :value => val}
									i += val.length
									break
								end
							end
						end
					end
				end
				if token
					tokens << token
					token_types_arr << token[:type]
				else
					i += 1
				end
			end
			@lexer_tokens = tokens
			@lexer_token_types_arr = token_types_arr
			@lexer_tokens = parseBracketsinLexerTokens
			@lexer_token_types_arr = []
			@lexer_tokens.each do |arr|
				@lexer_token_types_arr << arr[:type]
			end
		end

		def parseBracketsinLexerTokens lexer_tokens = @lexer_tokens
			i = 0
			tokens = []
			brackets = 0
			lbracket_index = -1
			while i < lexer_tokens.length
				current = lexer_tokens[i]
				if current[:type] == :lbracket
					brackets += 1
					if lbracket_index == -1
						lbracket_index = i
					end
				elsif current[:type] == :rbracket
					brackets -= 1
					if brackets == 0
						tokens << {:type => :brackets, :value => parseBracketsinLexerTokens(lexer_tokens[(lbracket_index + 1)...i]), :hash => @token_types[:brackets]}
						lbracket_index = -1
					end
				elsif brackets == 0
					tokens  << current
				end
				i += 1
			end
			tokens
		end

		def printLexerTokens
			arr = []
			@lexer_tokens.each do |t|
				arr << "#{t[:type].to_s} => #{t[:value]}"
			end
			puts arr.join(", ")
		end
		
		def parseLexerTokens
			parseBracketsinLexerTokens
			@start_token = Token.new self, @lexer_tokens, @lexer_token_types_arr
			@start_token
		end
		
		def eval str
			lex str
			parseLexerTokens
			@start_token.eval
		end
	end

	class Token
		attr_reader :value
		
		def initialize(leaf_parser, lexer_tokens, lexer_token_types_arr)
			@leaf_parser = leaf_parser
			@left = nil
			@right = nil
			parseLexerTokens lexer_tokens, lexer_token_types_arr
		end
		
		def parseLexerTokens tokens, lexer_token_types_arr
			if tokens.length == 1 && lexer_token_types_arr[0] == :brackets
				this = tokens[0]
				types = []
				this[:value].each do |val|
					types << val[:type]
				end
				@value = Token.new @leaf_parser, this[:value], types
				@type = this[:type]
				@leaf_action = this[:hash][:leaf_action]
			else
				split_type = nil
				@leaf_parser.token_types_arr.each do |type|
					if lexer_token_types_arr.include? type
						split_type = type
						break
					end
				end
				if split_type != nil
					index = lexer_token_types_arr.find_index split_type
					this = tokens[index]
					@value = this[:value]
					@type = this[:type]
					thash = this[:hash]
					@leaf_action = thash[:leaf_action]
					@left_leaf_action = thash[:left_leaf_action]
					@right_leaf_action = thash[:right_leaf_action]
					@both_leafs_action = thash[:both_leafs_action]
					if index != 0
						@left = Token.new @leaf_parser, tokens[0...index], lexer_token_types_arr[0...index]
					end
					if index < tokens.length - 1
						@right = Token.new @leaf_parser, tokens[(index + 1)..-1], lexer_token_types_arr[(index + 1)..-1]
					end
				end
			end
		end
		
		def eval output = false
			if output
				puts "++++++++++++++"
				puts @type
				if @left != nil
					puts "--------------"
					@left.print
					puts "--------------"
					@right.print
				end
			end
			if !@left && !@right
				@leaf_action.call self
			elsif @left && !@right
				@left_leaf_action.call self, @left
			elsif !@left && @right
				@right_leaf_action.call self, @right
			else
				@both_leafs_action.call self, @left, @right
			end
		end
		
		def print indent = 0
			if @type == :brackets
					puts (" " * indent) + "#{@type.to_s.ljust(32 - indent)}"
				@value.print(indent + 4)
			else
				puts (" " * indent) + "#{@type.to_s.ljust(32 - indent)} => #{@value.to_s.rjust 32}"
				@left.print(indent + 4) if @left != nil
				@right.print(indent + 4) if @right != nil
			end
		end
	end

	def self.eval str
		LexerParser.new.eval str
	end
end