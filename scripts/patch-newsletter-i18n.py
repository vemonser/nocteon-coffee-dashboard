"""Add the newsletter page's strings to the locale files (idempotent)."""
import io
import json

ADD = {
    "en": {
        "title": "Newsletter",
        "totalCount": "{{count}} addresses in the audience",
        "search": "Search addresses...",
        "empty": "There are no addresses in the audience yet.",
        "audience": (
            "The audience of a newsletter is the store's customers — the same "
            "list a broadcast goes to. The API does not carry a per-address "
            "newsletter flag, so an address that unsubscribed is still listed."
        ),
        "columns": {
            "email": "Email",
            "name": "Name",
            "role": "Role",
            "joined": "Joined",
            "lastActive": "Last active",
        },
        "export": {
            "button": "Export emails",
            "hint": (
                "Exports every address of the audience as a CSV, not only the "
                "rows on this page."
            ),
            "done": "The addresses were exported",
            "empty": "There are no addresses to export",
            "failed": "The addresses could not be exported",
        },
    },
    "ar": {
        "title": "النشرة البريدية",
        "totalCount": "{{count}} عنوان في الجمهور",
        "search": "ابحث في العناوين...",
        "empty": "لا توجد عناوين في الجمهور بعد.",
        "audience": (
            "جمهور النشرة البريدية هو عملاء المتجر — القائمة نفسها التي تصل "
            "إليها الرسالة الجماعية. الـ API لا يحمل علامة الاشتراك لكل "
            "عنوان، فالعنوان الذي ألغى اشتراكه ما زال مذكورًا."
        ),
        "columns": {
            "email": "البريد الإلكتروني",
            "name": "الاسم",
            "role": "الدور",
            "joined": "تاريخ الانضمام",
            "lastActive": "آخر نشاط",
        },
        "export": {
            "button": "تصدير العناوين",
            "hint": (
                "يصدّر كل عناوين الجمهور في ملف CSV، لا صفوف هذه الصفحة فقط."
            ),
            "done": "تم تصدير العناوين",
            "empty": "لا توجد عناوين للتصدير",
            "failed": "تعذّر تصدير العناوين",
        },
    },
}

for lang, extra in ADD.items():
    path = f"public/assets/i18n/{lang}.json"
    with io.open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    data.setdefault("newsletter", {}).update(extra)
    with io.open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print("patched", path)
