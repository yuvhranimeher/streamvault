#!/usr/bin/env python3
import socket
import threading
import ipaddress
import sys
from concurrent.futures import ThreadPoolExecutor
import ftplib
import time

def check_ftp(host, port=21, timeout=3):
    """Check if a host has an open FTP port"""
    try:
        # Create a socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        
        # Try to connect to the FTP port
        result = sock.connect_ex((host, port))
        if result == 0:
            # If connection was successful, try to get the FTP banner
            try:
                banner = sock.recv(1024).decode('utf-8').strip()
                return (host, port, banner)
            except:
                return (host, port, "Unknown")
        return None
    except:
        return None
    finally:
        sock.close()

def test_ftp_login(host, port=21, timeout=5):
    """Test common FTP login credentials"""
    common_creds = [
        ("anonymous", "anonymous@example.com"),
        ("anonymous", ""),
        ("ftp", "ftp"),
        ("admin", "admin"),
        ("admin", "password"),
        ("root", "root"),
        ("user", "user"),
        ("guest", "guest"),
    ]
    
    try:
        ftp = ftplib.FTP()
        ftp.set_pasv(True)  # Use passive mode
        ftp.connect(host, port, timeout=timeout)
        
        # Get the welcome message
        welcome = ftp.getwelcome()
        
        # Try common credentials
        for username, password in common_creds:
            try:
                ftp.login(username, password)
                return (True, username, password, welcome)
            except ftplib.error_perm as e:
                if "530" in str(e):  # Login incorrect
                    continue
                else:
                    # Other error, but still connected
                    return (True, None, None, welcome)
            except:
                continue
        
        return (False, None, None, welcome)
    except Exception as e:
        return (False, None, None, str(e))
    finally:
        try:
            ftp.quit()
        except:
            pass

def scan_network(network_range, max_threads=50, test_logins=False):
    """Scan a network range for FTP servers"""
    print(f"Scanning network range: {network_range}")
    print(f"Using {max_threads} threads")
    
    ftp_servers = []
    
    try:
        # Parse the network range
        network = ipaddress.ip_network(network_range, strict=False)
        
        # Create a thread pool
        with ThreadPoolExecutor(max_workers=max_threads) as executor:
            # Submit tasks for each IP in the range
            futures = []
            for ip in network.hosts():
                futures.append(executor.submit(check_ftp, str(ip)))
            
            # Collect results
            for future in futures:
                result = future.result()
                if result:
                    host, port, banner = result
                    ftp_servers.append((host, port, banner))
                    
                    # Test logins if requested
                    if test_logins:
                        login_result = test_ftp_login(host, port)
                        success, username, password, welcome = login_result
                        if success:
                            print(f"  LOGIN SUCCESS: {host}:{port} - User: {username}, Pass: {password}")
                        else:
                            print(f"  LOGIN FAILED: {host}:{port} - Common credentials don't work")
    
    except Exception as e:
        print(f"Error scanning network: {e}")
        return []
    
    return ftp_servers

def scan_random_ips(num_ips=1000, max_threads=50):
    """Scan random IP addresses for FTP servers"""
    import random
    
    print(f"Scanning {num_ips} random IP addresses")
    print(f"Using {max_threads} threads")
    
    ftp_servers = []
    
    # Generate random IP addresses
    random_ips = []
    for _ in range(num_ips):
        # Generate a random public IP address (excluding private ranges)
        first_octet = random.randint(1, 223)
        if first_octet == 10:
            continue  # Skip private 10.x.x.x
        elif first_octet == 172:
            second_octet = random.randint(0, 255)
            if 16 <= second_octet <= 31:
                continue  # Skip private 172.16-31.x.x
        elif first_octet == 192:
            second_octet = random.randint(0, 255)
            if second_octet == 168:
                continue  # Skip private 192.168.x.x
        
        second_octet = random.randint(0, 255)
        third_octet = random.randint(0, 255)
        fourth_octet = random.randint(1, 254)
        
        random_ips.append(f"{first_octet}.{second_octet}.{third_octet}.{fourth_octet}")
    
    # Create a thread pool
    with ThreadPoolExecutor(max_workers=max_threads) as executor:
        # Submit tasks for each IP
        futures = []
        for ip in random_ips:
            futures.append(executor.submit(check_ftp, ip))
        
        # Collect results
        for future in futures:
            result = future.result()
            if result:
                ftp_servers.append(result)
    
    return ftp_servers

def enumerate_ftp(host, port=21):
    """Enumerate FTP server for directories and files"""
    try:
        ftp = ftplib.FTP()
        ftp.set_pasv(True)
        ftp.connect(host, port, timeout=10)
        
        # Try anonymous login
        try:
            ftp.login("anonymous", "anonymous@example.com")
            print(f"Anonymous login successful for {host}:{port}")
        except:
            # Try to get list of users from the server
            try:
                ftp.login("ftp", "ftp")
                print(f"FTP login successful for {host}:{port}")
            except:
                print(f"No common login credentials work for {host}:{port}")
                return
        
        # Get current directory
        pwd = ftp.pwd()
        print(f"Current directory: {pwd}")
        
        # List files and directories
        try:
            files = []
            ftp.dir(files.append)
            print("Files and directories:")
            for f in files:
                print(f"  {f}")
        except:
            print("Could not list directory contents")
        
        # Try to change to common directories
        common_dirs = ["/", "/pub", "/incoming", "/uploads", "/download", "/files"]
        for directory in common_dirs:
            try:
                ftp.cwd(directory)
                print(f"Changed to directory: {directory}")
                files = []
                ftp.dir(files.append)
                print("Files and directories:")
                for f in files:
                    print(f"  {f}")
                ftp.cwd("/")  # Go back to root
            except:
                pass
        
        ftp.quit()
    except Exception as e:
        print(f"Error enumerating {host}:{port}: {e}")

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python ftp_scanner.py network <network_range> [--test-logins]")
        print("  python ftp_scanner.py random <num_ips>")
        print("  python ftp_scanner.py enumerate <host>")
        print("Examples:")
        print("  python ftp_scanner.py network 192.168.1.0/24 --test-logins")
        print("  python ftp_scanner.py network 172.16.50.0/24")
        print("  python ftp_scanner.py random 1000")
        print("  python ftp_scanner.py enumerate 172.16.50.7")
        return
    
    mode = sys.argv[1].lower()
    
    if mode == "network":
        if len(sys.argv) < 3:
            print("Please specify a network range (e.g., 192.168.1.0/24)")
            return
        
        network_range = sys.argv[2]
        test_logins = "--test-logins" in sys.argv
        ftp_servers = scan_network(network_range, test_logins=test_logins)
    
    elif mode == "random":
        num_ips = 1000
        if len(sys.argv) >= 3:
            try:
                num_ips = int(sys.argv[2])
            except:
                print("Invalid number of IPs, using default 1000")
        
        ftp_servers = scan_random_ips(num_ips)
    
    elif mode == "enumerate":
        if len(sys.argv) < 3:
            print("Please specify a host (e.g., 172.16.50.7)")
            return
        
        host = sys.argv[2]
        port = 21
        if len(sys.argv) >= 4:
            try:
                port = int(sys.argv[3])
            except:
                print("Invalid port number, using default 21")
        
        enumerate_ftp(host, port)
        return
    
    else:
        print("Invalid mode. Use 'network', 'random', or 'enumerate'")
        return
    
    # Print results
    print("\nScan complete!")
    print(f"Found {len(ftp_servers)} FTP servers:")
    for host, port, banner in ftp_servers:
        print(f"  {host}:{port} - {banner}")

if __name__ == "__main__":
    main()