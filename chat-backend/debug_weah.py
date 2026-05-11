import requests, time
uid = f"weah-{int(time.time())}"
h = {"Content-Type":"application/json","x-user-id":uid}
for msg in ["مين جورج ويا؟", "George Weah footballer", "جورج ويا لاعب كرة قدم"]:
    r = requests.post("http://localhost:3001/api/chat/send", headers=h, json={"message":msg}, timeout=30).json()
    print(f"[{msg}]")
    print(f"  cat: {r.get('aiMessage',{}).get('category','?')}")
    print(f"  txt: {r.get('aiMessage',{}).get('text','')[:120]}")
    time.sleep(1)
