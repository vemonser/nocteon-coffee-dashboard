#!/usr/bin/env python3
"""Add the Round-2 dashboard keys to the i18n files.

Idempotent: it only writes the keys that are missing or different, so it
can be re-run after a hand edit of the wording.
"""
import json
import collections
import io
import sys

ROOT = "public/assets/i18n"

ADDITIONS = {
    "en": {
        "dashboard": {
            "orderScope": {
                "paid": "Paid orders",
                "paidHelp": "Paid orders in the selected period. Cancelled, pending and refunded orders are not counted.",
            },
            "countSessions_one": "{{count}} session",
            "countSessions_other": "{{count}} sessions",
            "donutRevenue": "Revenue",
            "donutOrders": "Orders",
            "delta": {
                "noBaseline": "No data in the previous period",
            },
            "breakdownNote": "This chart adds up the line items (price × quantity). It does not include shipping or discounts, so it does not add up to the Total revenue card.",
            "ordersByStatus": "Orders by status",
            "devicesNote": "The store records one row per observed device session. The count is not a count of people.",
            "recentOrdersNote": "The four most recent orders, whatever their date.",
            "recentOrders": {
                "justNow": "just now",
                "unknownCustomer": "Unknown customer",
                "minutesAgo_one": "{{count}} min ago",
                "minutesAgo_other": "{{count}} mins ago",
                "hoursAgo_one": "{{count}} hour ago",
                "hoursAgo_other": "{{count}} hours ago",
                "daysAgo_one": "{{count}} day ago",
                "daysAgo_other": "{{count}} days ago",
            },
        },
        "orders": {
            "orderScope": {
                "all": "All orders",
                "allHelp": "Every order the store has, including cancelled, pending and refunded ones.",
            },
        },
    },
    "ar": {
        "dashboard": {
            "orderScope": {
                "paid": "الطلبات المدفوعة",
                "paidHelp": "الطلبات المدفوعة في الفترة المحددة. الطلبات الملغاة والمعلّقة والمستردة لا تُحتسب.",
            },
            "countSessions_zero": "{{count}} جلسة",
            "countSessions_one": "{{count}} جلسة",
            "countSessions_two": "{{count}} جلستان",
            "countSessions_few": "{{count}} جلسات",
            "countSessions_many": "{{count}} جلسة",
            "countSessions_other": "{{count}} جلسة",
            "donutRevenue": "الإيرادات",
            "donutOrders": "الطلبات",
            "delta": {
                "noBaseline": "لا توجد بيانات في الفترة السابقة",
            },
            "breakdownNote": "يجمع هذا الرسم عناصر الطلب (السعر × الكمية). لا يشمل الشحن ولا الخصومات، لذلك لا يطابق بطاقة إجمالي الإيرادات.",
            "ordersByStatus": "الطلبات حسب الحالة",
            "devicesNote": "يسجّل المتجر صفًا لكل جلسة جهاز تمت ملاحظتها. الرقم ليس عددًا للأشخاص.",
            "recentOrdersNote": "أحدث أربعة طلبات، أيًّا كانت تواريخها.",
            "recentOrders": {
                "justNow": "الآن",
                "unknownCustomer": "عميل غير معروف",
                "minutesAgo_zero": "الآن",
                "minutesAgo_one": "منذ دقيقة",
                "minutesAgo_two": "منذ دقيقتين",
                "minutesAgo_few": "منذ {{count}} دقائق",
                "minutesAgo_many": "منذ {{count}} دقيقة",
                "minutesAgo_other": "منذ {{count}} دقيقة",
                "hoursAgo_zero": "الآن",
                "hoursAgo_one": "منذ ساعة",
                "hoursAgo_two": "منذ ساعتين",
                "hoursAgo_few": "منذ {{count}} ساعات",
                "hoursAgo_many": "منذ {{count}} ساعة",
                "hoursAgo_other": "منذ {{count}} ساعة",
                "daysAgo_zero": "الآن",
                "daysAgo_one": "منذ يوم",
                "daysAgo_two": "منذ يومين",
                "daysAgo_few": "منذ {{count}} أيام",
                "daysAgo_many": "منذ {{count}} يومًا",
                "daysAgo_other": "منذ {{count}} يوم",
            },
        },
        "orders": {
            "orderScope": {
                "all": "كل الطلبات",
                "allHelp": "كل طلبات المتجر، بما فيها الملغاة والمعلّقة والمستردة.",
            },
        },
    },
}


def merge(dst, src):
    for key, value in src.items():
        if isinstance(value, dict):
            node = dst.get(key)
            if not isinstance(node, dict):
                node = {}
                dst[key] = node
            merge(node, value)
        else:
            dst[key] = value


def main():
    changed = []
    for lang, additions in ADDITIONS.items():
        path = f"{ROOT}/{lang}.json"
        with io.open(path, encoding="utf-8") as handle:
            data = json.load(handle, object_pairs_hook=collections.OrderedDict)
        before = json.dumps(data, ensure_ascii=False, sort_keys=True)
        merge(data, additions)
        after = json.dumps(data, ensure_ascii=False, sort_keys=True)
        if before == after:
            continue
        with io.open(path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        changed.append(path)
    print("updated:", ", ".join(changed) or "nothing")


if __name__ == "__main__":
    sys.exit(main())
