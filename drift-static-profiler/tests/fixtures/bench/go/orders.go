// Tiny bench fixture — struct + receiver methods + constructor convention.
// Shape parallels the Python fixture (no classes in Go; receiver type stands
// in as the containment anchor).
package bench

type OrderService struct {
	db map[string]string
}

func NewOrderService() *OrderService {
	return &OrderService{db: make(map[string]string)}
}

func (s *OrderService) Create(orderID string) string {
	s.db[orderID] = orderID
	return s.formatResult(orderID)
}

func (s *OrderService) Charge(orderID string, _amount int) string {
	return s.formatResult(orderID)
}

func (s *OrderService) formatResult(orderID string) string {
	return "tx-" + orderID
}

func main() {
	service := NewOrderService()
	service.Create("o-1")
	service.Charge("o-1", 100)
}
