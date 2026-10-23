# 需要以管理员权限运行
# 添加端口转发规则
netsh interface portproxy add v4tov4 listenaddress=172.30.145.20 listenport=4000 connectaddress=127.0.0.1 connectport=4000
netsh interface portproxy add v4tov4 listenaddress=172.30.145.20 listenport=4001 connectaddress=127.0.0.1 connectport=4001

# 添加防火墙规则
netsh advfirewall firewall add rule name="Open Port 4000" dir=in action=allow protocol=TCP localport=4000
netsh advfirewall firewall add rule name="Open Port 4001" dir=in action=allow protocol=TCP localport=4001

# 显示当前端口转发规则
netsh interface portproxy show all

Write-Host "端口转发和防火墙规则已设置。请重启 Docker 容器。"
