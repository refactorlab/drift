// Tiny bench fixture — class + constructor + methods + module-level
// `new` invocation. Shape parallels the Python fixture.

export class OrderService {
    private db = new Map<string, string>();

    constructor() {}

    create(orderId: string): string {
        this.db.set(orderId, orderId);
        return this.formatResult(orderId);
    }

    charge(orderId: string, _amount: number): string {
        return this.formatResult(orderId);
    }

    private formatResult(orderId: string): string {
        return `tx-${orderId}`;
    }
}

const service = new OrderService();
service.create("o-1");
service.charge("o-1", 100);
