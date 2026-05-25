// Tiny bench fixture — class + constructor + methods + module-level
// `new` invocation. Shape parallels the Python fixture.

export class OrderService {
    constructor() {
        this.db = new Map();
    }

    create(orderId) {
        this.db.set(orderId, orderId);
        return this.formatResult(orderId);
    }

    charge(orderId, _amount) {
        return this.formatResult(orderId);
    }

    formatResult(orderId) {
        return `tx-${orderId}`;
    }
}

const service = new OrderService();
service.create("o-1");
service.charge("o-1", 100);
