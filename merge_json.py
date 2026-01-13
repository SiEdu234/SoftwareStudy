import json
import os
import re

path = "c:/Users/simed/Music/Estudio HCI/example_quiz.json"

if not os.path.exists(path):
    print(f"Error: File not found at {path}")
    exit(1)

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Attempt to fix the specific pattern found: } \n {
# We will wrap it in a pseudo-array to parse it, or just use regex to split
# Because standard JSON parsers won't accept multiple roots.
# Regex to replace '}\n{' with '},{' -> then wrap in []? 
# No, we want to MERGE them into ONE quiz.

# Let's try to identify the boundary.
# The user file has:
# }
# {
# "title": ...

# We can replace '}\n{' with ', "next_quiz": {' to cheat? No.
# Best approach: find all top-level objects.

objs = []
decoder = json.JSONDecoder()
pos = 0
while True:
    try:
        # Skip whitespace
        while pos < len(content) and content[pos].isspace():
            pos += 1
        if pos >= len(content):
            break
            
        obj, end = decoder.raw_decode(content, idx=pos)
        objs.append(obj)
        pos = end
    except json.JSONDecodeError:
        # If we fail, maybe there is junk at the end or the file is still malformed
        print(f"Warning: JSON decode error at position {pos}. Attempting to salvage what we have.")
        break

if not objs:
    print("No valid JSON objects found.")
    exit(1)

print(f"Found {len(objs)} JSON objects.")

# Merge strategy:
# Keep the first object as the base.
# Append 'questions' from subsequent objects to the first one.
base_quiz = objs[0]
if "questions" not in base_quiz:
    base_quiz["questions"] = []

for i in range(1, len(objs)):
    q = objs[i]
    if "questions" in q:
        print(f"Merging {len(q['questions'])} questions from part {i+1}...")
        base_quiz["questions"].extend(q["questions"])

# Update title to indicate merged content
base_quiz["title"] += " (Combined)"

# Write back
with open(path, "w", encoding="utf-8") as f:
    json.dump(base_quiz, f, indent=4, ensure_ascii=False)

print("Successfully merged and fixed example_quiz.json")
