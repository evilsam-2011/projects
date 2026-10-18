import subprocess

result = subprocess.run("uname -a", shell=True, capture_output=True, text=True)
system_info = result.stdout.strip()

print(system_info)

