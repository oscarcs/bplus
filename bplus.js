/**
 * B+
 * Simple programming language.
 */

let bplus = (function() {

    let DEBUG = true;

    function debug(...args) {
        if (DEBUG) {
            console.log(...args);
        }
    }

    /**
     * Produce tokens using the program text. 
     */
    function lex(program) {
        let tokens = [{ symbol: "start", type: "START" }];
                
        let isAlpha = x => (
            (x.charCodeAt(0) >= 65 && x.charCodeAt(0) <= 90) ||
            (x.charCodeAt(0) >= 97 && x.charCodeAt(0) <= 122)
        );
        
        let isNumeric = x => (
            (x.charCodeAt(0) >= 48 && x.charCodeAt(0) <= 57)
        );
        
        let isAlphaNumeric = x => (
            isNumeric(x) || isAlpha(x)
        );   
        
        let isNewline = x => (
            x === "\r" || x === "\n"
        );

        let keywords = [
            'let', 
            'for', 
            'if', 
            'else', 
            'while', 
            'print', 
            'read', 
            'goto'
        ];

        let symbols = {
            '+': "OPERATOR",
            '-': "OPERATOR",
            '*': "OPERATOR",
            '/': "OPERATOR",
            '%': "OPERATOR",
            '>': "OPERATOR",
            '<': "OPERATOR",
            '>=': "OPERATOR",
            '<=': "OPERATOR",
            '==': "OPERATOR",
            '=': "OPERATOR",
            ':': "OPERATOR",
            '..': "OPERATOR",
            '{': "PAREN",
            '}': "PAREN",
            '(': "PAREN",
            ')': "PAREN"
        };

        function token(symbol, type) {
            tokens.push({
                symbol: symbol,
                type: type
            });
        }

        let c;
        let loc = -1;
        function advance() {
            loc++;
            c = program.charAt(loc);
            return c;
        } 

        function lookahead() {
            return program.charAt(loc + 1);
        }

        // Set the lexer to the initial state.
        advance();

        let iter = 0;
        while (loc < program.length && iter < program.length) {
            iter++;

            // Skip comments:
            if (c === "/" && lookahead() === "/") {
                while (!isNewline(c)) {
                    advance();
                }
                while(isNewline(c)) {
                    advance();
                }
            }

            // Skip spaces:
            else if  (c === " " || c === "\t") {
                advance();
            }

            // Skip newlines:
            else if (isNewline(c)) {
                advance();
                if (isNewline(c)) {
                    advance();
                }
                token("newline", "NEWLINE");
            }

            // Keywords and identifiers:
            else if (isAlpha(c)) {
                let ident = "";

                while (isAlphaNumeric(c)) {
                    ident += c;
                    advance();
                }

                if (keywords.includes(ident.toLowerCase())) {
                    // Add a keyword token:
                    token(ident.toLowerCase(), ident.toUpperCase());
                }
                else {
                    // Add an identifier token:
                    token(ident, "IDENTIFIER");
                }
            }

            // Numbers
            else if (isNumeric(c)) {
                let num = "";

                while (isNumeric(c)) {
                    num += c;
                    advance();
                }
                token(num, "NUMBER");
            }

            // Two-character operators:
            else if (c + lookahead() in symbols) {
                token(c + lookahead(), symbols[c]);
                advance();
                advance();
            }
            // Single-character operators:
            else if (c in symbols) {
                token(c, symbols[c]);
                advance();
            }

        }

        tokens.push({ symbol: "end", type: "END" });

        for (i in tokens) {

            var cur = tokens[i];
            var next = tokens[i + 1];

            debug("|" + cur.symbol, cur.type + "|");
        }
        return tokens;
    }

    /**
     * Parse code using a list of tokens. 
     * Expression parsing is performed using the 'precedence climbing'
     * algorithm. 
     * The parser overall employs a recursive descent strategy.
     * https://en.wikipedia.org/wiki/Recursive_descent_parser
     * http://eli.thegreenplace.net/2012/08/02/parsing-expressions-by-precedenc
     * e-climbing
     */
    function parse(tokens) {
        
        let loc = -1;
        let c;
        function advance() {
            loc++;
            c = tokens[loc];
            return c;
        }

        function lookahead() {
            return tokens[cur + 1];
        }

        // Test whether the current symbol is of a particular type.
        // If it is, advance.
        function accept(arg) {
            if (c.type === arg || c.symbol === arg) {
                advance();
                return true;
            }
            return false;
        }

        // Ensure that the current token is of a specified type.
        function expect(arg) {
            if (c.type === arg || c.symbol === arg) {
                return true;
            }
            throw `Unexpected token ${arg}`;
            //return false;
        }

        // Each binary operator has a precedence and associates either to the
        // left or to the right.
        let operators = {
            "+": { precedence: 1, associativity: 'left' },   
            "-": { precedence: 1, associativity: 'left' },   
            "*": { precedence: 2, associativity: 'left' },   
            "/": { precedence: 2, associativity: 'left' },   
        };

        // An 'atom' is the smallest constituent unit of an expression, i.e. 
        // an identifier or a number.
        function atom() {
            // Parse brackets as their own recursive subexpressions.
            if (accept("(")) {
                let val = expression(1);
                if (!accept(")")) {
                    throw "Expected )";
                }
                return val;
            }
            // Throw an error if there are two operators in a row:
            else if (accept("OPERATOR")) {
                throw "Expected an identifier or a number.";
            }
            // If the current token is actually an atom, return it:
            else if (c.type === "NUMBER" || c.type === "IDENTIFIER") {
                let ret = c;
                advance();
                return ret;
            }
        }

        // Parse an arithmetic expression. The fundamental step of this
        // algorithm is to consume the next atom and inspect the operator
        // beyond it. If that operator is less than the minimum permissable
        // precedence, the algorithm returns.
        // This is known as 'precedence climbing'.
        function expression(minPrecedence) {
            if (minPrecedence === undefined) minPrecedence = 1;

            let lhs = atom();

            while (true) {
                // If the current token is not an operator, then we're done
                // with this expression. We're also done if the precedence of
                // the current operator is smaller than the current lower 
                // bound.
                if (
                    c.type !== "OPERATOR" || 
                    operators[c.symbol].precedence < minPrecedence
                ) {    
                    break;
                }

                expect("OPERATOR");
                
                let op = c.symbol;
                let prec = operators[c.symbol].precedence;
                let assoc = operators[c.symbol].associativity;
                let nextMinPrecedence = assoc === "left" ? prec + 1 : prec;

                advance();
                let rhs = expression(nextMinPrecedence);

                // Create an AST node for this expression.
                lhs = { 
                    type: "EXPRESSION", 
                    left: lhs, 
                    right: rhs, 
                    operator: op
                };

            }
            return lhs;
        }

        function statement() {
            // Variable definition:
            if (accept("let")) {
                if (!accept("identifier")) {
                    throw "Expected identifier."
                }

                let name = c.symbol;

                if (!accept("=")) {
                    throw "Expected =";
                }

                let rhs = expression();

                return {
                    type: "ASSIGNMENT",
                    name: name,
                    expression: rhs 
                };
            }  
            // [Re]assignment:
            else if (accept("IDENTIFIER")) {
                if (!accept("=")) {
                    throw "Expected =";
                }

                let rhs = expression();

                return {
                    type: "ASSIGNMENT",
                    name: name,
                    rhs: rhs
                };
            }
            // Conditional:  
            else if (accept("if")) {
                let condition = expression();

                if (!accept("{")) {
                    throw "Expected {";
                }

                let body = block();

                if (!accept("}")) {
                    throw "Expected }";
                }

                return {
                    type: "IF",
                    condition: condition,
                    body: body
                };
            }
            // For loop:
            else if (accept("for")) {
                let condition = expression();
                
                if (!accept("{")) {
                    throw "Expected {";
                }

                let body = block();
                
                if (!accept("{")) {
                    throw "Expected }";
                }

                return { 
                    type: "FOR",
                    condition: condition, 
                    body: body 
                }; 
            }
            // While loop:
            else if (accept("while")) {
                let condition = expression();
                
                if (!accept("{")) {
                    throw "Expected {";
                }

                let body = block();

                if (!accept("{")) {
                    throw "Expected }";
                }

                return { 
                    type: "WHILE",
                    condition: condition, 
                    body: body 
                };
            }
        }

        // A block defines a list of statements.
        function block() {            
            if (!accept("{")) {
                throw "Expected {";
            }
            let statements = [];
            while (c.symbol !== '}') {
                let s = statement();
                statements.push(s);
            }

            return statements;
        }

        // A program consists of a list of statements.
        function program() {
            accept("START");

            let statements = [];
            /*
            while (lookahead().symbol !== 'END') {
                let s = statement();
                statements.push(s);
            }
            */
            console.log(statements);

            accept("END");
            
            return statements;
        }

        // Begin parsing:
        advance();
        let ast = program();

        return ast;
    }

    /**
     * Generate code from an AST. 
     */
    function generate(ast) {
        let output = "";

        return output;
    }

    function compile(program) {
        let tokens = lex(program);
        let ast = parse(tokens);
        let output = generate(ast);
        return output;
    }

    return compile;
})();

function reqListener() {
    bplus(this.responseText);
}

var oReq = new XMLHttpRequest();
oReq.addEventListener("load", reqListener);
oReq.open("GET", "test.bp");
oReq.send();