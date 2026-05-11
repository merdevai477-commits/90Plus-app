import requests, time
uid = f"debug-{int(time.time())}"
h = {"Content-Type":"application/json","x-user-id":uid}

tests = [
    "كام لاعب في الفريق؟",
    "اشرح نظام 4-3-3",
    "What is the best pre-match meal?",
    "إيه أكل ما بعد المباراة؟",
    "عندي شد عضلي في الفخذ",
    "مبروك لفرنسا على كأس العالم 2022",
]

for msg in tests:
    r = requests.post("http://localhost:3001/api/chat/send", headers=h,
        json={"message": msg}, timeout=30).json()
    t = r.get("aiMessage",{}).get("text","LIMIT/ERROR")
    c = r.get("aiMessage",{}).get("category","?")
    print(f"\n[{c}] {msg[:40]}")
    print(f"  → {t[:100]}")
    time.sleep(1.5)
