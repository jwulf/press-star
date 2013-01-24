<?xml version='1.0'?>
<xsl:stylesheet version="1.0" xml:space="preserve" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output encoding="UTF-8" indent="no" method="text" omit-xml-declaration="no" standalone="no" version="1.0"/>
<!-- Note: do not indent this file!  Any whitespace here will be reproduced in the output -->
<xsl:template match="/">
%define wwwdir %{_localstatedir}/www/html/docs
Name:          <xsl:value-of select="$book-title"/>-web-<xsl:value-of select="$web_type"/>
Version:       <xsl:value-of select="$rpmver"/>
Release:       <xsl:value-of select="$rpmrel"/>%{?dist}
Summary:       <xsl:value-of select="/bookinfo/subtitle"/><xsl:value-of select="/setinfo/subtitle"/><xsl:value-of select="/articleinfo/subtitle"/>
Group:         Documentation
License:       <xsl:value-of select="$license"/>
URL:           <xsl:value-of select="$url"/>
Source:        <xsl:value-of select="$src_url"/>%{name}-%{version}-<xsl:value-of select="$rpmrel"/>.tgz
BuildArch:     noarch
BuildRoot:     %{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)
BuildRequires: publican >= <xsl:value-of select="$spec_version"/>
Requires:      publican >= <xsl:value-of select="$spec_version"/>
<xsl:if test="$brand != 'publican-common'">BuildRequires: <xsl:value-of select="$brand"/></xsl:if>

%description
This is Publican Website <xsl:value-of select="$web_type"/> page using the brand: <xsl:value-of select="$brand"/>

%prep
%setup -q

%build
publican build --nocolours <xsl:value-of select="$embedtoc"/> --formats="html-single" --langs=all --publish

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT/%{wwwdir}
cp -rf publish/home/* $RPM_BUILD_ROOT/%{wwwdir}/.

%clean
rm -rf $RPM_BUILD_ROOT

%post
publican update_site

%files
%defattr(-,root,root,-)
%{wwwdir}/*

%changelog
<xsl:value-of select="$log"/>

</xsl:template>

</xsl:stylesheet>

