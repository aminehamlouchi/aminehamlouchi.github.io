#!/usr/bin/env python3
"""Prints the text of a one page PDF, one line per line. Used by check-resume.mjs."""
import re, sys
from pypdf import PdfReader
r = PdfReader(sys.argv[1])
for page in r.pages:
    for line in page.extract_text().splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        if line:
            print(line)
