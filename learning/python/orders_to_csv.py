import csv
import os
from pathlib import Path
from dotenv import load_dotenv
from woocommerce import API

# Load the shared .env from the repo root (one folder above python/)
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

wcapi = API(
    url=os.getenv("WC_URL"),
    consumer_key=os.getenv("WC_KEY"),
    consumer_secret=os.getenv("WC_SECRET"),
    version="wc/v3",
    timeout=30,
)


def fetch_orders(status=None, per_page=100):
    params = {"per_page": per_page}
    if status:
        params["status"] = status
    response = wcapi.get("orders", params=params)
    response.raise_for_status()  # stop with an error if the request failed
    return response.json()


def to_row(order):
    billing = order.get("billing", {})
    return {
        "id": order["id"],
        "status": order["status"],
        "total": order["total"],
        "currency": order["currency"],
        "customer": f"{billing.get('first_name', '')} {billing.get('last_name', '')}".strip(),
        "email": billing.get("email", ""),
        "created": order["date_created"],
        "items": "; ".join(f"{i['quantity']} x {i['name']}" for i in order["line_items"]),
        "items_count": sum(i["quantity"] for i in order["line_items"]),
    }


def main():
    orders = fetch_orders()
    rows = [to_row(o) for o in orders]

    with open("orders.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys() if rows else ["id"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Exported {len(rows)} orders to orders.csv")


if __name__ == "__main__":  # Python's way of saying "only run when executed directly"
    main()