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
        // Track the line position of each token for error-reporting purposes.
        let lineNumber = 1;

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
            (x === "\r" || x === "\n")
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
                type: type,
                line: lineNumber
            });
        }

        let c;
        let loc = -1;
        function advance() {
            loc++;
            c = program.charAt(loc);
            return c;
        } 

        // With the grammar of this language, we need a single character of
        // lookahead to differentiate tokens. 
        function lookahead() {
            return program.charAt(loc + 1);
        }

        // Set the lexer to the initial state.
        advance();

        // In the main loop of the lexer, we iterate through every character 
        // in the input, producing tokens as we go.
        while (loc < program.length) {

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
                token("newline", "NEWLINE");
                lineNumber++;
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
        debug(tokens);

        // Keep a track of which variables have been defined. This is a simple 
        // version of a symbol table, albeit one that doesn't track scope:
        let variables = [];
        let isDefined = x => variables.indexOf(x) !== -1; 

        let loc = -1;
        let c;
        function advance() {
            loc++;
            c = tokens[loc];
            return c;
        }

        function lookahead() {
            return tokens[loc + 1];
        }

        // Test whether the current symbol is of a particular type.
        // If it is, advance the position in the tokens.
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
            error(c, `Unexpected token ${arg}`);
        }

        // Each binary operator has a precedence and associates either to the
        // left or to the right.
        let binaryOps = {
            "==": { precedence: 3, associativity: 'left' },
            ">": { precedence: 3, associativity: 'left' },
            "<": { precedence: 3, associativity: 'left' },
            ">=": { precedence: 3, associativity: 'left' },
            "<=": { precedence: 3, associativity: 'left' },
            "-": { precedence: 4, associativity: 'left' },   
            "+": { precedence: 4, associativity: 'left' },   
            "*": { precedence: 5, associativity: 'left' },   
            "/": { precedence: 5, associativity: 'left' },   
        };

        let unaryOps = {
            "+": { precedence: 6 },
            "-": { precedence: 6 },
            "!": { precedence: 6 }
        };

        // An 'atom' is the smallest constituent unit of an expression, i.e. 
        // an identifier or a number.
        function atom() {
            // Parse brackets as their own recursive subexpressions.
            if (accept("(")) {
                let val = expression(1);
                if (!accept(")")) {
                    throw {
                        token: c,
                        message: "Unmatched '(', expected ')'"
                    };
                }
                return val;
            }
            // Handle unary prefix operators:
            if (c.type === "OPERATOR") {
                if (c.symbol in unaryOps) {
                    let op = c.symbol;
                    let prec = unaryOps[op].precedence;
                    advance();
                    let expr = expression(prec);
                    return {
                        type: "UNARY",
                        operator: op,
                        child: expr, 
                    };
                }
                else {
                    throw {
                        token: c,
                        message: `Expected unary prefix operator.`
                    };
                }
            }
            else if (c.type === "NUMBER") {
                let number = c;
                advance();
                return number;
            }
            else if (c.type === "IDENTIFIER") {
                let ident = c;
                
                if (!isDefined(c.symbol)) {
                    throw {
                        token: c,
                        message: `The identifier '${c.symbol}' is not defined.`
                    };
                }
                
                advance();
                return ident;
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
                    binaryOps[c.symbol].precedence < minPrecedence
                ) {    
                    break;
                }

                expect("OPERATOR");
                
                let op = c.symbol;
                let prec = binaryOps[c.symbol].precedence;
                let assoc = binaryOps[c.symbol].associativity;
                let nextMinPrecedence = assoc === "left" ? prec + 1 : prec;

                advance();
                let rhs = expression(nextMinPrecedence);

                // Create an AST node for this expression.
                lhs = { 
                    type: "BINARY", 
                    left: lhs, 
                    right: rhs, 
                    operator: op
                };

            }
            return lhs;
        }

        // A statement is the building-block of the language. They are 
        // terminated with one or more 'separators', i.e. newlines
        function statement() {
            // The statement node to be returned:
            var s;

            // Variable definition:
            if (accept("LET")) {

                let name = c;
                advance();

                if (!accept("=")) {
                    throw {
                        token: c,
                        message: "Expected =",
                    };
                }

                let rhs = expression();

                if (!isDefined(name.symbol)) {
                    variables.push(name.symbol);
                }
                else {
                    throw {
                        token: name,
                        message: `Variable ${name.symbol} is already defined`
                    };
                }

                s = {
                    type: "ASSIGNMENT",
                    name: name.symbol,
                    rhs: rhs 
                };
            }
            // Two types of statements start with an identifier: a label, and
            // a variable assignment.  
            else if (c.type === "IDENTIFIER") {
                
                let name = c;
                advance();

                // Assign an expression to an identifier that has already been 
                // defined. 
                if (accept("=")) {

                    if (!isDefined(name.symbol)) {
                        throw {
                            token: name,
                            message: `The identifier '${name.symbol}' is ` + 
                            `not defined.`
                        };
                    }

                    let rhs = expression();

                    s = {
                        type: "ASSIGNMENT",
                        name: name.symbol,
                        rhs: rhs
                    };
                }
                // Label definition:
                else if (accept(":")) {
                    s = {
                        type: "LABEL",
                        name: name.symbol
                    };
                }
                else {
                    throw {
                        token: c,
                        message: `Unexpected ${c.symbol}`
                    };
                }

            }
            // A conditional consists of an if-statement with optional 
            // if-else-statements and an optional else-statement:
            else if (accept("IF")) {

                let condition = expression();
                let body = block();

                s = {
                    type: "CONDITIONAL",
                    conditions: [condition],
                    bodies: [body]
                };

                separator();

                // This is a state machine for if/else if/else blocks.
                let elif = true;
                while (elif) {
                    if (accept("ELSE")) {
                        // We've reached an else-if conditional:
                        if (accept("IF")) {
                            let condition = expression();

                            if (condition === undefined) {
                                throw {
                                    token: c,
                                    message: 'Expected expression.'
                                };
                            }

                            let body = block();
                            separator();

                            s.conditions.push(condition);
                            s.bodies.push(body);
                        }
                        // We've reached the terminating else block:
                        else {
                            let body = block();

                            // An else-statement is unconditional, so we set 
                            // the conditional to true:
                            s.conditions.push({
                                type: "NUMBER", 
                                symbol: "1"
                            });
                            s.bodies.push(body);

                            elif = false;
                        } 
                    }
                    else {
                        elif = false;
                    }
                }
            }
            // For loop:
            else if (accept("FOR")) {
                
                // Parse the variable that will be incremented:
                let name = c;

                // If the variable name isn't defined, define it:
                if (!isDefined(name)) {
                    variables.push(name.symbol);
                }

                advance();

                accept("=");

                // Start from the value of one expression and continue 
                // iterating upwards until the value of 'end' is reached.
                let start = expression();
                advance("..");
                let end = expression();

                let body = block();

                s = { 
                    type: "FOR",
                    name: name.symbol,
                    start: start,
                    end: end, 
                    body: body 
                }; 
            }
            // While loop:
            else if (accept("WHILE")) {
                
                let condition = expression();
                let body = block();

                s = { 
                    type: "WHILE",
                    condition: condition, 
                    body: body 
                };
            }
            // Print statement:
            else if (accept("PRINT")) {
                let child = expression();
                s = {
                    type: "PRINT",
                    child: child
                };
            }
            // Read statement:
            else if (accept("READ")) {
                s = {
                    type: "READ"
                };
            }
            // Goto statement:
            else if (accept("goto")) {
                let name = c.symbol; 
                advance();

                s = {
                    type: "GOTO",
                    name: name
                };
            }
            else {
                throw {
                    token: c,
                    message: `Unexpected ${c.symbol}`
                };
            }

            separator(true);

            return s;
        }

        // A block defines a list of statements.
        function block() {

            separator();           
            if (!accept("{")) {
                throw {
                    token: c,
                    message: "Expected {"
                };
            }
            separator();

            let statements = [];
            while (!accept('}')) {
                let s = statement();
                statements.push(s);
            }

            return statements;
        }

        // The separator is the symbol between statements, in this case
        // statements are separated by newlines.
        function separator(enforce) {
            numSeparators = 0;
            while (accept("NEWLINE")) {
                numSeparators++;
            }

            if (enforce === true && numSeparators === 0 && c.type !== "END") {
                throw {
                    token: c,
                    message: `Expected statement separator before '${c.symbol}'`
                };
            }
        }

        // A program consists of a list of statements.
        function program() {
            accept("START");

            let statements = [];
            separator();
            while (!accept("END")) {
                let s = statement();
                statements.push(s);
            }
            
            return statements;
        }

        // Begin parsing:
        advance();
        let statements = program();

        return {
            type: "PROGRAM",
            children: statements 
        };
    }

    /**
     * Generate code from an AST. 
     */
    function generate(ast) {
        let output = "";

        debug(ast);

        function headers() {
            return [
                `#include <stdio.h>`,
                ``,
                `int main() {`
            ].join("\n");
        }

        function generate() {
            let body = [];

            // Keep track of which variables have been defined:
            let defined = [];
            let isDefined = n => defined.indexOf(n) !== -1;

            // Operator tables:

            // Operators that have a direct analogue in C:
            let verbatimOp = ['+', '-', '/', '*', '==', '>=', '<=', '>', '<'];

            function generateNode(node) {

                switch(node.type) {
                
                    case "PROGRAM":
                        for (let child of node.children) {
                            generateNode(child);
                        }

                        break;

                    /*
                        Statement-level constructs:
                    */
                    
                    case "ASSIGNMENT":
                        if (!isDefined(node.name)) {
                            body.push(`int ${node.name};`);
                            defined.push(node.name);
                        }

                        let rhs = generateNode(node.rhs);

                        body.push(`${node.name} = ${rhs};`);

                        break;

                    case "WHILE":
                        let whileCond = generateNode(node.condition);

                        body.push(`while (${whileCond}) {`);
                        for (let child of node.body) {
                            generateNode(child);
                        }
                        body.push(`}`);

                        break;

                    case "FOR":
                        
                        if (!isDefined(node.name)) {
                            body.push(`int ${node.name};`);
                        }

                        // Start and end are expressions containing values to
                        // loop between.
                        let start = generateNode(node.start);
                        let end = generateNode(node.end);

                        // Generate the three for loop statements:
                        body.push([`for (${node.name} = ${start};`,
                            `${node.name} < ${end};`,
                            `${node.name}++) {`]
                        .join(" "));

                        for (let child of node.body) {
                            generateNode(child);
                        }
                        body.push(`}`);

                        break;

                    case "CONDITIONAL":

                        // Get the leading condition:
                        let ifCond = generateNode(node.conditions[0]);
                        
                        // Generate the body of the if statement:
                        body.push(`if (${ifCond}) {`);
                        for (let child of node.bodies[0]) {
                            generateNode(child);
                        }
                        body.push(`}`)

                        // Generate 'else if' blocks. In lieu of an else block,
                        // which would make parsing more difficult, we add an
                        // 'else if (1)'.
                        for (let i = 1; i < node.conditions.length; i++) {
                            // Get the condition:
                            let elseIfCond = generateNode(node.conditions[i]);
                            
                            // Generate the body statements:
                            body.push(`else if (${elseIfCond}) {`);
                            for (let child of node.bodies[i]) {
                                generateNode(child);
                            }
                            body.push(`}`);
                        }

                        break;

                    case "PRINT":
                        let printExpr = generateNode(node.child);
                        body.push(`printf("%i\\n", ${printExpr});`);
                        break;

                    case "LABEL":
                        body.push(`${node.name}:`);
                        break;

                    case "GOTO":
                        body.push(`goto ${node.name};`);
                        break;

                    
                    /*
                        Expression-level constructs:
                    */

                    case "UNARY":
                        let child = generateNode(node.child);

                        let unaryOp;
                        // Check if there is a directly equivalent operator in
                        // C.
                        if (verbatimOp.indexOf(node.operator) !== -1) {
                            unaryOp = node.operator;
                        }

                        return `(${unaryOp}${child})`;

                        break;

                    case "BINARY":
                        let left = generateNode(node.left); 
                        let right = generateNode(node.right);

                        let binaryOp;
                        // Check if there is a directly equivalent operator in
                        // C.
                        if (verbatimOp.indexOf(node.operator) !== -1) {
                            binaryOp = node.operator;
                        }
                        
                        return `(${left} ${binaryOp} ${right})`;

                        break;

                    case "NUMBER":
                        return node.symbol;

                    case "IDENTIFIER":
                        return node.symbol;

                    default:
                        // body.push("");
                }
            }

            generateNode(ast);
            body = body.join("\n\t");
            return body;
        }

        output = [
            headers(),
            `\t${generate()}`,
            `}`
        ].join("\n");

        return output;
    }

    function printError(token, message, program) {
        
        let lines = [];
        lines[0] = program.split("\n")[token.line - 2];
        lines[1] = program.split("\n")[token.line - 1];
        lines[2] = program.split("\n")[token.line];

        // Get rid of undefined values; replace them with ''
        lines = lines.map(x => x = (x === undefined ? '' : x));

        let msg = [
            `Error on line ${token.line}:`,
            `          ${lines[0]}`,
            `   --->   ${lines[1]}`,
            `          ${lines[2]}`,
            `${message}`
        ].join("\n");

        console.error(msg);
    }

    function compile(program, debug) {

        if (typeof debug !== 'undefined') {
            DEBUG = debug;
        }
        
        // Replace Windows-style line endings with Unix ones for simplicity.
        program = program.replace(/\r\n/g, '\n');

        // Perform the actual compilation:
        let tokens, ast, output;
        try {
            tokens = lex(program);
            ast = parse(tokens);
            output = generate(ast);
        }
        // Handle errors. Errors that are in the appropriate format will be
        // printed as proper compiler errors.
        catch (e) {
            if (typeof e.token !== 'undefined') {
                printError(e.token, e.message, program);
            }
            else {
                console.error(e);
            }
        }
        return output;
    }

    return compile;
})();

const env = typeof window === 'undefined' ? "node" : "browser";

// If running under NodeJS:
if (env === "node") {
    let fs = require('fs');
    let exec = require('child_process').exec;

    let program = fs.readFileSync('./test.bp', 'utf8');
    let output = bplus(program, false);

    // If there were no errors duing compilation, we output the generated code
    // into a C file and compile it:
    if (typeof output !== 'undefined') {

        // Write out the generated code:
        fs.writeFileSync('./out.c', output);

        // Define a print function as a callback to exec():
        let print = function (error, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
        };

        // Invoke the C compiler and the binary:
        exec("cc -o out out.c && ./out", print);
    }
}
// If running in a browser:
else {
    function listener() {
        bplus(this.responseText);
    }

    let request = new XMLHttpRequest();
    request.addEventListener("load", listener);
    request.open("GET", "test.bp");
    request.send();
}