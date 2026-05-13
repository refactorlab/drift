from .service import process_order, send_notification


def main() -> None:
    order = {"id": 1, "amount": 42}
    process_order(order)
    send_notification(order)


if __name__ == "__main__":
    main()
