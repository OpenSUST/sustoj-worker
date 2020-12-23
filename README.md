# Sust Online Judge Worker

## Usage

### Prerequisites

#### Packages

```bash
sudo apt install build-essential clang++-9 libfmt-dev cmake
```

If the following text appears:

```
E: Unable to locate package clang++-9
E: Couldn't find any package by regex 'clang++-9'
```

You need to add a source to `/etc/apt/sources.list`:

```
deb http://deb.debian.org/debian/ testing main
```

#### Kernel

```bash
sudo nano /etc/default/grub
```

Add `swapaccount=1` to `GRUB_CMDLINE_LINUX_DEFAULT`:

```
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

sudo chroot /opt/rootfs /bin/sh

adduser sandbox
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
sudo chroot /opt/rootfs /bin/sh

echo "nameserver: 1.1.1.1" > /etc/resolv.conf

apk update
```

#### Python

```bash
apk add python3
```

#### Java

```bash
apk --no-cache add openjdk11 --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community
```

## Author

Shirasawa

## License

[MIT](./LICENSE)
