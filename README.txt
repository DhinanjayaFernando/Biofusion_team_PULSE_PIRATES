Clone this Repository to a directory

For Windows
1)Install dependencies: (only once)
```bash
pip install -r requirements.txt
```
2)Open RUN_APP.bat in notepad (only once) & replace "D:\p1" in start "ML Blood App" cmd /k "cd /d D:\p1 && uvicorn app:app --reload --host 0.0.0.0 --port 8000" to the cloned file directory

3)Run RUN_APP.bat & it will open up the web browser page (If the page was unresponsive, reload the page. That will fix it)


For Linux (Universal)
Go to the cloned directory
```bash
chmod +x RUN_APP.sh
./RUN_APP.sh
```

For Ubuntu / Debian / Linux Mint
Go to the cloned directory
```bash
chmod +x RUN_APP_UBUNTU.sh
./RUN_APP_UBUNTU.sh
```

For Arch / Manjaro / EndeavourOS
Go to the cloned directory
```bash
chmod +x RUN_APP_ARCH.sh
./RUN_APP_ARCH.sh
```
