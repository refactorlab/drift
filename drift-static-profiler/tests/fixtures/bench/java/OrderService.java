// Tiny bench fixture — class + constructor + methods + static main.
// Shape parallels the Python fixture so per-language numbers compare.
package bench;

import java.util.HashMap;
import java.util.Map;

public class OrderService {
    private final Map<String, String> db = new HashMap<>();

    public OrderService() {}

    public String create(String orderId) {
        db.put(orderId, orderId);
        return formatResult(orderId);
    }

    public String charge(String orderId, int amount) {
        return formatResult(orderId);
    }

    private String formatResult(String orderId) {
        return "tx-" + orderId;
    }

    public static void main(String[] args) {
        OrderService service = new OrderService();
        service.create("o-1");
        service.charge("o-1", 100);
    }
}
