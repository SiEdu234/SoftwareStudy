import re
import os
import sys

path = "c:/Users/simed/Music/Estudio HCI/example_quiz.json"

if not os.path.exists(path):
    print(f"Error: File not found at {path}")
    sys.exit(1)

try:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Regex to find [cite_start ]"feedback" and replace with "feedback"
    # The user diff showed: [cite_start\n            ]"feedback"
    # So we need to handle newlines
    new_content = re.sub(r'\[cite_start\s+\]"feedback"', '"feedback"', content)

    # Optional: remove other cite tags if they exist inside strings like [cite: 26]
    # But those are valid conceptual strings, just valid JSON is needed.
    # The main issue is the key breaking the structure.

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print("Success: JSON patched.")

except Exception as e:
    print(f"Error patching file: {e}")
    sys.exit(1)
