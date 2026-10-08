"""Refresh data/youtube.json with the channel's latest uploads (no API key needed).
Run from the project root: python3 tools/youtube-latest.py
"""
import json, re, urllib.request, xml.etree.ElementTree as ET
UA = {"User-Agent": "Mozilla/5.0 kardi-hq/1.0"}
HANDLE = "kardinaloffishall416"
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read().decode("utf-8", "ignore")
page = get(f"https://www.youtube.com/{HANDLE}")
cid = re.search(r'"channelId":"(UC[\w-]+)"', page) or re.search(r'channel_id=(UC[\w-]+)', page)
cid = cid.group(1)
subs = re.search(r'"subscriberCountText":\{"simpleText":"([^"]+)"', page) or re.search(r'([\d.,]+[KM]?) subscribers', page)
feed = ET.fromstring(get(f"https://www.youtube.com/feeds/videos.xml?channel_id={cid}"))
ns = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015", "m": "http://search.yahoo.com/mrss/"}
vids = []
for e in feed.findall("a:entry", ns)[:6]:
    vid = e.find("yt:videoId", ns).text
    vids.append({"id": vid, "title": e.find("a:title", ns).text, "published": e.find("a:published", ns).text[:10],
                 "url": f"https://www.youtube.com/watch?v={vid}", "thumb": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"})
out = {"handle": HANDLE, "url": f"https://www.youtube.com/{HANDLE}", "channel_id": cid,
       "subscribers": subs.group(1) if subs else "300K+", "videos": vids}
json.dump(out, open("data/youtube.json", "w"), indent=2, ensure_ascii=False); open("data/youtube.json", "a").write("\n")
print(cid, out["subscribers"], len(vids), "videos")
for v in vids: print(" ", v["published"], v["title"][:70])
