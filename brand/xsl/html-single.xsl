<?xml version='1.0'?>

<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
		version='1.0'
		xmlns="http://www.w3.org/1999/xhtml"
		exclude-result-prefixes="#default">

<xsl:import href="http://docbook.sourceforge.net/release/xsl/current/xhtml/docbook.xsl"/>
<xsl:import href="../../../xsl/html-single.xsl"/>

<xsl:import 
href="http://docbook.sourceforge.net/release/xsl/current/xhtml/graphics.xsl"/>

<!-- inject our javascript into the footer -->
<!-- http://www.sagehill.net/docbookxsl/InsertExtHtml.html -->
<!-- Inject a div.skynetBookID with Product_Name/Book_Name
  This is used for cookies for the book -->
<xsl:template name="user.footer.content">
   <div class="skynetBookID"><xsl:value-of select="//productname[1]"/>/<xsl:value-of select="//title[1]"/></div>
   <script src="Common_Content/css/modernizr.js"></script>
   <script src="Common_Content/css/jquery-1.4.2.min.js"></script>
   <script src="Common_Content/css/code-lang-switcher.js"></script>
   <script src="Common_Content/css/skynet-book.js"></script>
   <script src="Common_Content/css/deathstar.js"></script>
</xsl:template>

<!-- set the onload of the page -->
<!-- http://www.sagehill.net/docbookxsl/BodyAtts.html -->
<xsl:template name="body.attributes">
  <xsl:attribute name="onLoad">skynetBookLoad()</xsl:attribute>
</xsl:template>

<!-- depth of section labelling -->
<xsl:param name="section.autolabel.max.depth" select="2"/>

<!-- Make videos work in Firefox -->
<xsl:template match="videoobject">
  <xsl:apply-templates select="videodata"/>
</xsl:template>

<xsl:template match="videodata">
  <xsl:call-template name="process.image">
    <xsl:with-param name="tag" select="'iframe'"/>
    <xsl:with-param name="alt">
      <xsl:apply-templates select="(../../textobject/phrase)[1]"/>
    </xsl:with-param>
  </xsl:call-template>
</xsl:template>

<xsl:template match="section[@role = 'skynet-defaultcodeselector']"  mode="toc" />

<!-- Simple target names in html - no section / chapter numbers -->
<xsl:param name="local.l10n.xml" select="document('')"/>
<l:i18n xmlns:l="http://docbook.sourceforge.net/xmlns/l10n/1.0">
  <l:l10n language="en">
    <l:context name="xref-number-and-title">
      <l:template name="section" style="simpletarget" text="%t"/>
    </l:context>
  </l:l10n>
</l:i18n>

<xsl:param name="local.l10n.xml" select="document('')"/>
<l:i18n xmlns:l="http://docbook.sourceforge.net/xmlns/l10n/1.0">
  <l:l10n language="en">
    <l:context name="xref-number-and-title">
      <l:template name="chapter" style="simpletarget" text="%t"/>
    </l:context>
  </l:l10n>
</l:i18n>

<xsl:param name="local.l10n.xml" select="document('')"/>
<l:i18n xmlns:l="http://docbook.sourceforge.net/xmlns/l10n/1.0">
  <l:l10n language="en">
    <l:context name="xref-number-and-title">
      <l:template name="section" style="see-also" text="%t"/>
    </l:context>
  </l:l10n>
</l:i18n>

<xsl:param name="local.l10n.xml" select="document('')"/>
<l:i18n xmlns:l="http://docbook.sourceforge.net/xmlns/l10n/1.0">
  <l:l10n language="en">
    <l:context name="xref-number-and-title">
      <l:template name="chapter" style="see-also" text="%t"/>
    </l:context>
  </l:l10n>
</l:i18n>

<xsl:param name="local.l10n.xml" select="document('')"/>
<l:i18n xmlns:l="http://docbook.sourceforge.net/xmlns/l10n/1.0">
  <l:l10n language="en">
    <l:context name="xref-number-and-title">
      <l:template name="section" style="prereq" text="%t"/>
    </l:context>
  </l:l10n>
</l:i18n>

<xsl:param name="local.l10n.xml" select="document('')"/>
<l:i18n xmlns:l="http://docbook.sourceforge.net/xmlns/l10n/1.0">
  <l:l10n language="en">
    <l:context name="xref-number-and-title">
      <l:template name="chapter" style="prereq" text="%t"/>
    </l:context>
  </l:l10n>
</l:i18n>

<xsl:param name="local.l10n.xml" select="document('')"/>
<l:i18n xmlns:l="http://docbook.sourceforge.net/xmlns/l10n/1.0">
  <l:l10n language="en">
    <l:context name="xref-number-and-title">
      <l:template name="section" style="link-list" text="%t"/>
    </l:context>
  </l:l10n>
</l:i18n>

<xsl:param name="local.l10n.xml" select="document('')"/>
<l:i18n xmlns:l="http://docbook.sourceforge.net/xmlns/l10n/1.0">
  <l:l10n language="en">
    <l:context name="xref-number-and-title">
      <l:template name="chapter" style="link-list" text="%t"/>
    </l:context>
  </l:l10n>
</l:i18n>

<xsl:param name="generate.toc">
set toc
book toc
article toc
chapter toc
qandadiv toc
qandaset toc
sect1 nop
sect2 nop
sect3 nop
sect4 nop
sect5 nop
section toc
part toc
</xsl:param>
</xsl:stylesheet>

