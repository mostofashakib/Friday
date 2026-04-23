import sys
import os

# Ensure backend package is on the path when pytest runs from repo root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
