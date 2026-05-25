// Tiny bench fixture — struct + impl block (containment anchor) +
// methods + associated `new`. Shape parallels the Python fixture.
use std::collections::HashMap;

pub struct OrderService {
    db: HashMap<String, String>,
}

impl OrderService {
    pub fn new() -> Self {
        Self { db: HashMap::new() }
    }

    pub fn create(&mut self, order_id: String) -> String {
        self.db.insert(order_id.clone(), order_id.clone());
        self.format_result(order_id)
    }

    pub fn charge(&mut self, order_id: String, _amount: u32) -> String {
        self.format_result(order_id)
    }

    fn format_result(&self, order_id: String) -> String {
        format!("tx-{order_id}")
    }
}

fn main() {
    let mut service = OrderService::new();
    service.create("o-1".to_string());
    service.charge("o-1".to_string(), 100);
}
