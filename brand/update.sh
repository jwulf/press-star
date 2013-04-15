git pull
rpm -e publican-deathstar
publican package --binary
rpm -ivh tmp/rpm/noarch/publican-deathstar-0*
