"""Make the count labels of the two pages agree in number (the app's
plural convention: <base>_<Intl.PluralRules category>)."""
import io
import json

ADD = {
    "en": {
        "broadcasts": {
            "totalCount_one": "1 broadcast",
            "totalCount_other": "{{count}} broadcasts",
        },
        "newsletter": {
            "totalCount_one": "1 address in the audience",
            "totalCount_other": "{{count}} addresses in the audience",
        },
    },
    "ar": {
        "broadcasts": {
            "totalCount_zero": "لا رسائل",
            "totalCount_one": "رسالة واحدة",
            "totalCount_two": "رسالتان",
            "totalCount_few": "{{count}} رسائل",
            "totalCount_many": "{{count}} رسالة",
            "totalCount_other": "{{count}} رسالة",
        },
        "newsletter": {
            "totalCount_zero": "لا عناوين في الجمهور",
            "totalCount_one": "عنوان واحد في الجمهور",
            "totalCount_two": "عنوانان في الجمهور",
            "totalCount_few": "{{count}} عناوين في الجمهور",
            "totalCount_many": "{{count}} عنوانًا في الجمهور",
            "totalCount_other": "{{count}} عنوان في الجمهور",
        },
    },
}

for lang, extra in ADD.items():
    path = f"public/assets/i18n/{lang}.json"
    with io.open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    for namespace, values in extra.items():
        data.setdefault(namespace, {}).update(values)
    with io.open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print("patched", path)
