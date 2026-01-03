For Windows
1)Install dependencies:
```bash
pip install -r requirements.txt
```
2)Open RUN_APP.bat in notepad & replace "D:\p1" in start "ML Blood App" cmd /k "cd /d D:\p1 && uvicorn app:app --reload --host 0.0.0.0 --port 8000" to the current file directory

3)Run RUN_APP.bat & it will open up the web browser page (If the page was unresponsive, reload the page. That will fix it)

For Linux refer SETUP_GUIDE.md
