pub const MAX_DEPTH: usize = 64;

pub enum Token {
    Ident(String),
    Number(f64),
}

pub struct Parser {
    depth: usize,
}

impl Parser {
    pub fn new() -> Self {
        Parser { depth: 0 }
    }

    pub fn parse(&mut self, input: &str) -> Vec<Token> {
        let _ = input;
        Vec::new()
    }
}

pub fn tokenize(input: &str) -> Vec<Token> {
    let _ = input;
    Vec::new()
}
