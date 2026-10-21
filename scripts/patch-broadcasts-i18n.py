"""Add the broadcasts page's new strings to the locale files (idempotent)."""
import io
import json

ADD = {
    "en": {
        "delete": "Delete the broadcast",
        "deleteTitle": "Delete this broadcast",
        "deleteConfirm": "The broadcast and its recipient list are removed. Delete",
        "deleted": "The broadcast was deleted",
        "export": {
            "button": "Export broadcasts",
            "done": "The broadcasts were exported",
            "empty": "There are no broadcasts to export",
            "failed": "The broadcasts could not be exported",
        },
    },
    "ar": {
        "delete": "حذف الرسالة الجماعية",
        "deleteTitle": "حذف هذه الرسالة الجماعية",
        "deleteConfirm": "تُحذف الرسالة الجماعية وقائمة مستلميها. هل تريد حذف",
        "deleted": "تم حذف الرسالة الجماعية",
        "export": {
            "button": "تصدير الرسائل",
            "done": "تم تصدير الرسائل الجماعية",
            "empty": "لا توجد رسائل جماعية للتصدير",
            "failed": "تعذّر تصدير الرسائل الجماعية",
        },
    },
}

for lang, extra in ADD.items():
    path = f"public/assets/i18n/{lang}.json"
    with io.open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    broadcasts = data.setdefault("broadcasts", {})
    for key, value in extra.items():
        if isinstance(value, dict):
            broadcasts.setdefault(key, {}).update(value)
        else:
            broadcasts[key] = value
    with io.open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print("patched", path)
