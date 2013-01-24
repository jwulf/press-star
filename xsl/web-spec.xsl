<?xml version='1.0'?>

<!-- Transform bookinfo.xml into a SPEC File -->
<xsl:stylesheet version="1.0" xml:space="preserve" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output encoding="UTF-8" indent="no" method="text" omit-xml-declaration="no" standalone="no" version="1.0"/>
<!-- Note: do not indent this file!  Any whitespace here
     will be reproduced in the output -->
<xsl:template match="/">#Publican Document Specfile
%define RHEL5 %(test %{?dist} == .el5 &amp;&amp; echo 1 || echo 0)
%define HTMLVIEW %(test %{RHEL5} == 1 &amp;&amp; echo 1 || echo 0)

%define viewer xdg-open
%define ICONS <xsl:value-of select="$ICONS"/>
%define wwwdir <xsl:value-of select="$web_dir"/>

%if %{HTMLVIEW}
%define viewer htmlview
%endif

Name:          <xsl:value-of select="$book-title"/>-web-<xsl:value-of select="$lang"/>
Version:       <xsl:value-of select="$rpmver"/>
Release:       <xsl:value-of select="$rpmrel"/>%{?dist}
<xsl:if test="$translation = '1'">Summary:      <xsl:value-of select="$language"/> translation of <xsl:value-of select="$book-title"/>
Summary(<xsl:value-of select="$lang"/>):       <xsl:value-of select="$full_subtitle"/></xsl:if>
<xsl:if test="$translation != '1'">Summary:       <xsl:value-of select="$full_subtitle"/></xsl:if>
Group:         Documentation
License:       <xsl:value-of select="$license"/>
URL:           <xsl:value-of select="$url"/>
Source:        <xsl:value-of select="$src_url"/>%{name}-%{version}-<xsl:value-of select="$rpmrel"/>.tgz
BuildArch:      noarch
BuildRoot:     %{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)
BuildRequires: publican >= <xsl:value-of select="$spec_version"/>
BuildRequires: desktop-file-utils
Requires:      publican >= <xsl:value-of select="$spec_version"/>
<xsl:if test="$brand != 'publican-common'">BuildRequires: <xsl:value-of select="$brand"/></xsl:if>
<xsl:if test="$web_obsoletes != ''">Obsoletes:    <xsl:value-of select="$web_obsoletes"/></xsl:if>
<xsl:if test="$web_req != ''">Requires:    <xsl:value-of select="$web_req"/></xsl:if>
Requires:      <xsl:value-of select="$brand"/>-web

%description
<xsl:if test="$translation = '1'"><xsl:value-of select="$language"/> translation of <xsl:value-of select="$book-title"/>

%description -l <xsl:value-of select="$lang"/> </xsl:if>
<xsl:value-of select="$abstract" />

%package -n <xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>
<xsl:if test="$translation = '1'">
Summary:      <xsl:value-of select="$language"/> translation of <xsl:value-of select="$docname"/>
Summary(<xsl:value-of select="$lang"/>):    <xsl:value-of select="$full_subtitle"/>
</xsl:if>
<xsl:if test="$translation != '1'">
Summary:    <xsl:value-of select="$full_subtitle"/></xsl:if>

Group:        Documentation
%if %{HTMLVIEW}
Requires:    htmlview
%else
Requires:    xdg-utils
%endif
<xsl:if test="$dt_obsoletes != ''">Obsoletes:    <xsl:value-of select="$dt_obsoletes"/></xsl:if>
<xsl:if test="$dt_requires != ''">Requires:    <xsl:value-of select="$dt_requires"/></xsl:if>

%description  -n <xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>
<xsl:if test="$translation = '1'"><xsl:value-of select="$language"/> translation of <xsl:value-of select="$docname"/>

%description -l <xsl:value-of select="$lang"/>  -n <xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/> </xsl:if>
<xsl:value-of select="$abstract" />

%prep
%setup -q

%build
publican build --nocolours <xsl:value-of select="$embedtoc"/> --formats="<xsl:value-of select="$web_formats_comma"/>,html-desktop" --langs=<xsl:value-of select="$lang"/> --publish

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT/%{wwwdir}
mkdir -p $RPM_BUILD_ROOT%{_datadir}/applications
mkdir -p $RPM_BUILD_ROOT/usr/share/icons/hicolor/scalable/apps
cp -rf publish/<xsl:value-of select="$lang"/> $RPM_BUILD_ROOT/%{wwwdir}/.

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


cat > <xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>-<xsl:value-of select="$rpmver"/>.desktop &lt;&lt;'EOF'
[Desktop Entry]
Name=<xsl:value-of select="/bookinfo/productname" /><xsl:value-of select="/setinfo/productname" /><xsl:value-of select="/articleinfo/productname"/> <xsl:value-of select="/bookinfo/productnumber" /><xsl:value-of select="/setinfo/productnumber" /><xsl:value-of select="/articleinfo/productnumber"/>: <xsl:value-of select="/bookinfo/title" /><xsl:value-of select="/setinfo/title" /><xsl:value-of select="/articleinfo/title"/>
Comment=<xsl:value-of select="$full_subtitle"/>
Exec=%{viewer} %{_docdir}/<xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>-%{version}/index.html
Icon=<xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>
Categories=Documentation;<xsl:value-of select="$menu_category"/>
Type=Application
Encoding=UTF-8
Terminal=false
EOF

%if %{HTMLVIEW}
desktop-file-install --vendor=redhat --dir=${RPM_BUILD_ROOT}%{_datadir}/applications <xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>-<xsl:value-of select="$rpmver"/>.desktop
%else
desktop-file-install --dir=${RPM_BUILD_ROOT}%{_datadir}/applications <xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>-<xsl:value-of select="$rpmver"/>.desktop
%endif


%preun -n <xsl:value-of select="$book-title"/>-web-<xsl:value-of select="$lang"/>
if [ "$1" = "0" ] ; then # last uninstall
publican update_db --del --lang="<xsl:value-of select="$lang"/>" --formats="<xsl:value-of select="$web_formats_comma" />" --name="<xsl:value-of select="$docname" />" --version="<xsl:value-of select="$prodver" />" --product="<xsl:value-of select="$prod" />" --site_config="<xsl:value-of select="$web_cfg"/>"
fi

%post -n <xsl:value-of select="$book-title"/>-web-<xsl:value-of select="$lang"/>
publican update_db --add --lang="<xsl:value-of select="$lang"/>" --formats="<xsl:value-of select="$web_formats_comma" />" --name="<xsl:value-of select="$docname" />" --version="<xsl:value-of select="$prodver" />" --product="<xsl:value-of select="$prod" />" --subtitle="<xsl:value-of select="$full_subtitle"/>" --abstract="<xsl:value-of select="$full_abstract" />" <xsl:if test="$name_label != ''">--name_label="<xsl:value-of select="$name_label" />"</xsl:if> <xsl:if test="$version_label != ''">--version_label="<xsl:value-of select="$version_label" />"</xsl:if> <xsl:if test="$product_label != ''">--product_label="<xsl:value-of select="$product_label" />"</xsl:if> --site_config="<xsl:value-of select="$web_cfg"/>" <xsl:if test="$sort_order != ''">--sort_order="<xsl:value-of select="$sort_order" />"</xsl:if>

# Update Icon cache if it exists
%post -n <xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>
touch --no-create %{_datadir}/icons/hicolor &amp;>/dev/null || :

%postun -n <xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>
if [ $1 -eq 0 ] ; then
    touch --no-create %{_datadir}/icons/hicolor &amp;>/dev/null
    gtk-update-icon-cache %{_datadir}/icons/hicolor &amp;>/dev/null || :
fi

%posttrans -n <xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>
gtk-update-icon-cache %{_datadir}/icons/hicolor &amp;>/dev/null || :

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root,-)
%{wwwdir}/<xsl:value-of select="$lang"/>

%files -n <xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>
%defattr(-,root,root,-)
%doc <xsl:value-of select="$tmpdir"/>/<xsl:value-of select="$lang"/>/html-desktop/*
%if %{ICONS}
/usr/share/icons/hicolor/*
%else
/usr/share/icons/hicolor/scalable/apps/<xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>.svg
%endif
%if %{HTMLVIEW}
%{_datadir}/applications/redhat-<xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>-<xsl:value-of select="$rpmver"/>.desktop
%else
%{_datadir}/applications/<xsl:value-of select="$book-title"/>-<xsl:value-of select="$lang"/>-<xsl:value-of select="$rpmver"/>.desktop
%endif

%changelog
<xsl:value-of select="$log"/>

</xsl:template>

</xsl:stylesheet>

