%define brand deathstar
%define wwwdir /var/www/html/docs

Name:		publican-deathstar
Summary:	Common documentation files for %{brand}
Version:	0.48
Release:	1%{?dist}
License:	GPL v2
Group:		Applications/Text
Buildroot:	%{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)
Source:		https://svn.devel.redhat.com/repos/ecs/toolkit/publican-deathstar/%{name}-%{version}.tgz
Requires:	publican >= 3.0
BuildRequires:	publican >= 3.0
URL:		https://svn.devel.redhat.com/repos/ecs/toolkit/publican-deathstar
BuildArch:  	noarch

%description
This package provides common files and templates needed to build documentation
for %{brand} with publican.

%package web
Summary:	Web styles for %{brand}
Group:		Documentation
Requires:	publican >= 3.0

%description web
Web Site common files for the %{brand} brand.

%prep
%setup -q 

%build
publican build --formats=xml --langs=all --publish

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p -m755 $RPM_BUILD_ROOT%{_datadir}/publican/Common_Content
publican install_brand --path=$RPM_BUILD_ROOT%{_datadir}/publican/Common_Content
mkdir -p -m755 $RPM_BUILD_ROOT%{wwwdir}/%{brand}
publican install_brand --web --path=$RPM_BUILD_ROOT%{wwwdir}/%{brand}

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root,-)
%doc README
%doc COPYING
%{_datadir}/publican/Common_Content/%{brand}

%files web
%defattr(-,root,root,-)
%{wwwdir}/%{brand}

%changelog
* Thu May 01 2013 Joshua Wulf <jwulf@redhat.com> 0.48
- Support for changing topic title from editor
- Automated Revision History Generation

* Tue Apr 23 2013 Joshua Wulf <jwulf@redhat.com> 0.47
- Live patching now embeds the topic revision number as a css class: pg-topic-rev-<revision>
- Topic driver implemented on server. 
- Changelog now preserved during live patch
- Added navigation menu from publican website

* Wed Apr 17 2013 Joshua Wulf <jwulf@redhat.com> 0.46
- Updated jQuery to 1.9.1
- Added PressGang protoype REST library
- Started work on automated Revision History generation

* Sat Apr 13 2013 Joshua Wulf <jwulf@redhat.com> 0.45
- Added generic notifier for server push events
- Refactor title flash to independent function
- Removed section and chapter numbering for xrefs
- Added embedded Death Star control panel, rendered using client-side EJS and JSON
- Better notifications system to integrate with event-emitting Books on the server
- Lost socket connection notification ala gmail

* Thu Apr 11 2013 Joshua Wulf <jwulf@redhat.com> 0.44
- Adding flashing window title when book is rebuilt on server (Steve Gordon's idea)

* Tue Apr 09 2013 Joshua Wulf <jwulf@redhat.com> 0.43
- Added rebuilt notification div and socket handler
- Book can now notify user when it has been rebuilt on the server

* Mon Apr 08 2013 Joshua Wulf <jwulf@redhat.com> 0.42
- Styling for Fixed Revision Topics
- Patching via websocket from server

* Thu Apr 04 2013 Joshua Wulf <jwulf@redhat.com> 0.41
- Preserve TOC anchor and section number when doing a live update
- Call the Death Star REST API to persist live updates

* Mon Mar 17 2013 Joshua Wulf <jwulf@redhat.com> 0.40
- Incorporated all the latest shizzle from redhat-video

* Thu Dec 06 2012 Joshua Wulf <jwulf@redhat.com> 0.30
- Added css for master selector. Cleaned up and commented code
 
* Fri Sep 28 2012 Joshua Wulf <jwulf@redhat.com> 0.29
- Forked from redhat-video to deathstar

* Thu Aug 16 2012 Cheryn Tan <chetan@redhat.com> 0.28-1
- Fixes for Publican 3.0

* Mon Aug 13 2012 Joshua Wulf <jwulf@redhat.com> 0.28
- Updates for Publican 3.0

* Sun Aug 05 2012 Joshua Wulf <jwulf@redhat.com> 0.27
- Moved javascript to bottom of page as per http://developer.yahoo.com/performance/rules.html#js_bottom
- Removed all inline javascript from html
- Implemented master switcher (no css yet)
- Added skynetBookID div to footer for cookie matching

* Tue Jul 24 2012 Joshua Wulf <jwulf@redhat.com> 0.26
- Fix for BZ 839460 Create xrefstyles to match csprocessor output 
 
* Tue Jul 24 2012 Joshua Wulf <jwulf@redhat.com> 0.25
- Fix for BZ 842483: Interaction of codetabs and named anchors
- Added ExclusiveArch: for compatibility with brew

* Mon Jul 23 2012 Joshua Wulf <jwulf@redhat.com> 0.22
- Added features from development branch:
- Brand includes JavaScript (embedded jQuery)
- Google Web fonts for great aesthetic justice
- <variablelist role="codetabs"> creates code switcher in html output
- Supports embedded video in Firefox

* Fri Nov  4 2011  Joshua Wulf <jwulf@redhat.com> 0.1
- Created Brand

