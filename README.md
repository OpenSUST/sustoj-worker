# Sust Online Judge Worker

## Usage

### Prerequisites

#### Packages

```bash
sudo apt install build-essential clang++-9 libfmt-dev
```

#### Kernel

```bash
sudo nano /etc/default/grub
```

Add swapaccount=1 to GRUB_CMDLINE_LINUX_DEFAULT:

```txt
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash cgroup_enable=memory swapaccount=1"
```

And then run:

```bash
sudo update-grub

sudo reboot
```

#### Rootfs

```bash
sudo mkdir /opt/rootfs

sudo curl -L https://dl-cdn.alpinelinux.org/alpine/v3.12/releases/x86_64/alpine-minirootfs-3.12.3-x86_64.tar.gz | tar -xzvf - -C /opt/rootfs
```

### Build

```bash
git clone https://github.com/OpenSUST/sustoj-worker.git

cd sustoj-worker

npm install --production

npm run build
```

### Run

```bash
sudo node index
```

Then edit the `config.json` file, and restart the process.

### Add language support

#### Prerequisites

```bash
su

echo "nameserver: 1.1.1.1" > /opt/rootfs/etc/resolv.conf

chroot /opt/rootfs /bin/sh

apt update
```

#### Python

```bash
apt add python3
```

#### Java

```bash
apk --no-cache add openjdk11 --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community
```

## Author

Shirasawa

## License

[MIT](./LICENSE)
