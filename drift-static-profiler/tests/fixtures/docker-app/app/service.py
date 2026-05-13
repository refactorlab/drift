import logging

log = logging.getLogger(__name__)


def process_order(order: dict) -> dict:
    log.info("processing %s", order["id"])
    return order


def send_notification(order: dict) -> None:
    log.info("notify %s", order["id"])
