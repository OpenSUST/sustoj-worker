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
sudo apt-get install debootstrap

debootstrap --components=main,universe buster /opt/rootfs https://mirrors.tuna.tsinghua.edu.cn/debian

sudo chroot /opt/rootfs /bin/bash

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

```bash
sudo chroot /opt/rootfs /bin/bash
```

Then see: https://github.com/syzoj/sandbox-rootfs-ng/blob/master/install.sh

### C/C++

> Host install only.

```bash
apt-get install gcc g++
```

### Java

> Both host and virtual machine install.

```bash
# sudo mount --bind /dev/pts /opt/rootfs/dev/pts

mount -t proc proc /proc

apt-get install openjdk-11-jdk
```

### Python

> Virtual machine install only.

```bash
apt-get install python3.9

# or

apt-get install pypy3
```

## Author

Shirasawa

## License

[MIT](./LICENSE)
