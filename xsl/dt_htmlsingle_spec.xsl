<?xml version='1.0'?>

<!-- Transform bookinfo.xml into a SPEC File -->
<xsl:stylesheet version="1.0" xml:space="preserve" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output encoding="UTF-8" indent="no" method="text" omit-xml-declaration="no" standalone="no" version="1.0"/>
<!-- Note: do not indent this file!  Any whitespace here
     will be reproduced in the output -->
<xsl:template match="/">#Publican Documentation Specfile
%define RHEL5 %(test %{?dist} == .el5 &amp;&amp; echo 1 || echo 0)
%define HTMLVIEW %(test %{RHEL5} == 1 &amp;&amp; echo 1 || echo 0)

%define ICONS <xsl:value-of select="$ICONS"/>

%define viewer xdg-open

%if %{HTMLVIEW}
%define viewer htmlview
%define vendor redhat-
%define vendoropt --vendor="redhat"
%endif

Name:         <xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>
Version:      <xsl:value-of select="$rpmver"/>
Release:      <xsl:value-of select="$rpmrel"/>%{?dist}
<xsl:if test="$translation = '1'">
Summary:      <xsl:value-of select="$language"/> translation of <xsl:value-of select="$docname"/>
Summary(<xsl:value-of select="$lang"/>):    <xsl:value-of select="$full_subtitle"/>
</xsl:if>
<xsl:if test="$translation != '1'">
Summary:       <xsl:value-of select="$full_subtitle"/>
</xsl:if>
Group:         Documentation
License:       <xsl:value-of select="$license"/>
URL:           <xsl:value-of select="$url"/>
Source:        <xsl:value-of select="$src_url"/>%{name}-%{version}-<xsl:value-of select="$rpmrel"/>.tgz
BuildArch:      noarch
BuildRoot:     %{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)
BuildRequires: publican >= <xsl:value-of select="$spec_version"/>
BuildRequires: desktop-file-utils
<xsl:if test="$brand != 'publican-common'">BuildRequires:    <xsl:value-of select="$brand"/></xsl:if>

%if %{HTMLVIEW}
Requires:    htmlview
%else
Requires:    xdg-utils
%endif
<xsl:if test="$dt_obsoletes != ''">Obsoletes:    <xsl:value-of select="$dt_obsoletes"/></xsl:if>
<xsl:if test="$dt_requires != ''">Requires:    <xsl:value-of select="$dt_requires"/></xsl:if>

%description
<xsl:if test="$translation = '1'"><xsl:value-of select="$language"/> translation of <xsl:value-of select="$docname"/>

%description -l <xsl:value-of select="$lang"/></xsl:if>
<xsl:value-of select="$abstract" />

%prep
%setup -q

%build
publican build --nocolours --formats="html-desktop" --langs=<xsl:value-of select="$lang"/>

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT%{_datadir}/applications
mkdir -p $RPM_BUILD_ROOT/usr/share/icons/hicolor/scalable/apps

%if %{ICONS}
for icon in `ls <xsl:value-of select="$lang"/>/icons/*x*.png`; do
  size=`echo "$icon" | sed -e 's/.*icons\/\(.*\)\.png/\1/'`;
  mkdir -p $RPM_BUILD_ROOT/usr/share/icons/hicolor/$size/apps
  cp $icon  $RPM_BUILD_ROOT/usr/share/icons/hicolor/$size/apps/<xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>.png;
done
cp <xsl:value-of select="$lang"/>/icons/icon.svg  $RPM_BUILD_ROOT/usr/share/icons/hicolor/scalable/apps/<xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>.svg;
%else
cp <xsl:value-of select="$lang"/>/images/icon.svg  $RPM_BUILD_ROOT/usr/share/icons/hicolor/scalable/apps/<xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>.svg;
%endif

cat > %{name}.desktop &lt;&lt;'EOF'
[Desktop Entry]
Name=<xsl:value-of select="/bookinfo/productname" /><xsl:value-of select="/setinfo/productname" /><xsl:value-of select="/articleinfo/productname"/> <xsl:value-of select="/bookinfo/productnumber" /><xsl:value-of select="/setinfo/productnumber" /><xsl:value-of select="/articleinfo/productnumber"/>: <xsl:value-of select="/bookinfo/title" /><xsl:value-of select="/setinfo/title" /><xsl:value-of select="/articleinfo/title"/>
Comment=<xsl:value-of select="/bookinfo/subtitle"/><xsl:value-of select="/setinfo/subtitle"/><xsl:value-of select="/articleinfo/subtitle"/>
Exec=%{viewer} %{_docdir}/%{name}-%{version}/index.html
Icon=<xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>
Categories=Documentation;<xsl:value-of select="$menu_category"/>
Type=Application
Encoding=UTF-8
Terminal=false
EOF

%if %{HTMLVIEW}
desktop-file-install  %{?vendoropt} --dir=${RPM_BUILD_ROOT}%{_datadir}/applications %{name}.desktop
%else
desktop-file-install --dir=${RPM_BUILD_ROOT}%{_datadir}/applications %{name}.desktop
%endif

# Update Icon cache if it exists
%post
touch --no-create %{_datadir}/icons/hicolor &amp;>/dev/null || :

%postun
if [ $1 -eq 0 ] ; then
    touch --no-create %{_datadir}/icons/hicolor &amp;>/dev/null
    gtk-update-icon-cache %{_datadir}/icons/hicolor &amp;>/dev/null || :
fi

%posttrans
gtk-update-icon-cache %{_datadir}/icons/hicolor &amp;>/dev/null || :

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root,-)
%doc <xsl:value-of select="$tmpdir"/>/<xsl:value-of select="$lang"/>/html-desktop/*
%if %{ICONS}
/usr/share/icons/hicolor/*
%else
/usr/share/icons/hicolor/scalable/apps/<xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>.svg
%endif
%if %{HTMLVIEW}
%{_datadir}/applications/%{?vendor}%{name}.desktop
%else
%{_datadir}/applications/%{name}.desktop
%endif

%changelog
<xsl:value-of select="$log"/>

</xsl:template>

</xsl:stylesheet>

