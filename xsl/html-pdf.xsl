<?xml version='1.0'?>

<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns="http://www.w3.org/1999/xhtml"
				xmlns:exsl="http://exslt.org/common"
				version="1.0"
				exclude-result-prefixes="exsl">

<xsl:import href="http://docbook.sourceforge.net/release/xsl/current/xhtml/docbook.xsl"/>
<xsl:import href="http://docbook.sourceforge.net/release/xsl/current/xhtml/titlepage.xsl"/>
<xsl:import href="defaults.xsl"/>
<xsl:import href="xhtml-common.xsl"/>

<xsl:output method="xml" encoding="UTF-8" indent="no" doctype-public="-//W3C//DTD XHTML 1.0 Strict//EN" doctype-system="http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd" omit-xml-declaration="no" />

<xsl:param name="html.append"/>
<xsl:param name="generate.toc">
set toc,title
book toc,title,qandadiv
article toc,title
chapter nop
qandadiv nop
qandaset nop
sect1 nop
sect2 nop
sect3 nop
sect4 nop
sect5 nop
section nop
part nop
</xsl:param>

<!--
From: html/component.xsl
Reason: Override Chapter H2 to H1 for PDF titles
-->
<xsl:template name="component.title">
  <xsl:param name="node" select="."/>

  <xsl:variable name="level">
    <xsl:choose>
      <xsl:when test="ancestor::section">
        <xsl:value-of select="count(ancestor::section)+1"/>
      </xsl:when>
      <xsl:when test="ancestor::sect5">6</xsl:when>
      <xsl:when test="ancestor::sect4">5</xsl:when>
      <xsl:when test="ancestor::sect3">4</xsl:when>
      <xsl:when test="ancestor::sect2">3</xsl:when>
      <xsl:when test="ancestor::sect1">2</xsl:when>
      <xsl:otherwise>0</xsl:otherwise>
    </xsl:choose>
  </xsl:variable>

  <!-- Let's handle the case where a component (bibliography, for example)
       occurs inside a section; will we need parameters for this? -->

  <xsl:element name="h{$level+1}">
    <xsl:attribute name="class">title</xsl:attribute>
    <xsl:if test="$generate.id.attributes = 0">
      <xsl:call-template name="anchor">
	<xsl:with-param name="node" select="$node"/>
	<xsl:with-param name="conditional" select="0"/>
      </xsl:call-template>
    </xsl:if>
      <xsl:apply-templates select="$node" mode="object.title.markup">
      <xsl:with-param name="allow-anchors" select="1"/>
    </xsl:apply-templates>
  </xsl:element>
</xsl:template>

<!--
From: xhtml/docbook.xsl
Reason: add TOC div for web site
Version:
-->

<xsl:template match="*" mode="process.root">
  <xsl:variable name="doc" select="self::*"/>

  <xsl:call-template name="user.preroot"/>
  <xsl:call-template name="root.messages"/>

  <html>
    <head>
      <xsl:call-template name="system.head.content">
        <xsl:with-param name="node" select="$doc"/>
      </xsl:call-template>
      <xsl:call-template name="head.content">
        <xsl:with-param name="node" select="$doc"/>
      </xsl:call-template>
      <xsl:call-template name="user.head.content">
        <xsl:with-param name="node" select="$doc"/>
      </xsl:call-template>
    </head>
    <body>
      <xsl:call-template name="body.attributes"/>
     <xsl:call-template name="user.header.content">
        <xsl:with-param name="node" select="$doc"/>
      </xsl:call-template>
<!--      <p xmlns="http://www.w3.org/1999/xhtml">
        <xsl:attribute name="id">
           <xsl:text>title</xsl:text>
        </xsl:attribute>
        <a class="left">
          <xsl:attribute name="href">
              <xsl:value-of select="$prod.url"/>
          </xsl:attribute>
          <img src="Common_Content/images/image_left.png" alt="Product Site"/>
        </a>
        <a class="right">
          <xsl:attribute name="href">
            <xsl:value-of select="$doc.url"/>
          </xsl:attribute>
          <img src="Common_Content/images/image_right.png" alt="Documentation Site"/>
        </a>
      </p>
-->
      <xsl:apply-templates select="."/>
      <xsl:call-template name="user.footer.content">
        <xsl:with-param name="node" select="$doc"/>
      </xsl:call-template>
    </body>
  </html>
  <xsl:value-of select="$html.append"/>
</xsl:template>

<xsl:template name="head.content">
  <xsl:param name="node" select="."/>
  <xsl:param name="title">
    <xsl:apply-templates select="$node" mode="object.title.markup.textonly"/>
  </xsl:param>

  <title>
    <xsl:copy-of select="$product"/> <xsl:copy-of select="$title"/>
  </title>

  <xsl:if test="$html.base != ''">
    <base href="{$html.base}"/>
  </xsl:if>

  <!-- Insert links to CSS files or insert literal style elements -->
  <xsl:call-template name="generate.css"/>

  <xsl:if test="$html.stylesheet != ''">
    <xsl:call-template name="output.html.stylesheets">
      <xsl:with-param name="stylesheets" select="normalize-space($html.stylesheet)"/>
    </xsl:call-template>
  </xsl:if>

  <xsl:if test="$link.mailto.url != ''">
    <link rev="made" href="{$link.mailto.url}"/>
  </xsl:if>

  <meta name="generator" content="DocBook {$DistroTitle} V{$VERSION}"/>

  <xsl:if test="$generate.meta.abstract != 0">
    <xsl:variable name="info" select="(articleinfo                                       |bookinfo                                       |prefaceinfo                                       |chapterinfo                                       |appendixinfo                                       |sectioninfo                                       |sect1info                                       |sect2info                                       |sect3info                                       |sect4info                                       |sect5info                                       |referenceinfo                                       |refentryinfo                                       |partinfo                                       |info                                       |docinfo)[1]"/>
    <xsl:if test="$info and $info/abstract">
      <meta name="description">
        <xsl:attribute name="content">
          <xsl:for-each select="$info/abstract[1]/*">
            <xsl:value-of select="normalize-space(.)"/>
            <xsl:if test="position() &lt; last()">
              <xsl:text> </xsl:text>
            </xsl:if>
          </xsl:for-each>
        </xsl:attribute>
      </meta>
    </xsl:if>
  </xsl:if>

  <xsl:if test="($draft.mode = 'yes' or                 ($draft.mode = 'maybe' and                 ancestor-or-self::*[@status][1]/@status = 'draft'))                 and $draft.watermark.image != ''">
    <style type="text/css"><xsl:text>
body { background-image: url('</xsl:text>
<xsl:value-of select="$draft.watermark.image"/><xsl:text>');
       background-repeat: no-repeat;
       background-position: top left;
       /* The following properties make the watermark "fixed" on the page. */
       /* I think that's just a bit too distracting for the reader... */
       /* background-attachment: fixed; */
       /* background-position: center center; */
     }</xsl:text>
    </style>
  </xsl:if>
  <xsl:apply-templates select="." mode="head.keywords.content"/>
</xsl:template>

<xsl:template name="make.toc">
  <xsl:param name="toc-context" select="."/>
  <xsl:param name="toc.title.p" select="true()"/>
  <xsl:param name="nodes" select="/NOT-AN-ELEMENT"/>

  <xsl:variable name="nodes.plus" select="$nodes | qandaset"/>

  <xsl:variable name="toc.title">
    <xsl:if test="$toc.title.p">
      <h1 class="toc-title">
        <xsl:call-template name="gentext">
          <xsl:with-param name="key">TableofContents</xsl:with-param>
        </xsl:call-template>
      </h1>
    </xsl:if>
  </xsl:variable>

  <xsl:choose>
    <xsl:when test="$manual.toc != ''">
      <xsl:variable name="id">
        <xsl:call-template name="object.id"/>
      </xsl:variable>
      <xsl:variable name="toc" select="document($manual.toc, .)"/>
      <xsl:variable name="tocentry" select="$toc//tocentry[@linkend=$id]"/>
      <xsl:if test="$tocentry and $tocentry/*">
        <div class="toc">
          <xsl:copy-of select="$toc.title"/>
          <xsl:element name="{$toc.list.type}" namespace="http://www.w3.org/1999/xhtml">
            <xsl:call-template name="manual-toc">
              <xsl:with-param name="tocentry" select="$tocentry/*[1]"/>
            </xsl:call-template>
          </xsl:element>
        </div>
      </xsl:if>
    </xsl:when>
    <xsl:otherwise>
      <xsl:choose>
        <xsl:when test="$qanda.in.toc != 0">
          <xsl:if test="$nodes.plus">
            <div class="toc">
              <xsl:copy-of select="$toc.title"/>
              <xsl:element name="{$toc.list.type}" namespace="http://www.w3.org/1999/xhtml">
                <xsl:apply-templates select="$nodes.plus" mode="toc">
                  <xsl:with-param name="toc-context" select="$toc-context"/>
                </xsl:apply-templates>
              </xsl:element>
            </div>
          </xsl:if>
        </xsl:when>
        <xsl:otherwise>
          <xsl:if test="$nodes">
            <div class="toc">
              <xsl:copy-of select="$toc.title"/>
              <xsl:element name="{$toc.list.type}" namespace="http://www.w3.org/1999/xhtml">
                <xsl:apply-templates select="$nodes" mode="toc">
                  <xsl:with-param name="toc-context" select="$toc-context"/>
                </xsl:apply-templates>
              </xsl:element>
            </div>
          </xsl:if>
        </xsl:otherwise>
      </xsl:choose>

    </xsl:otherwise>
  </xsl:choose>
</xsl:template>

<xsl:template match="abstract" mode="titlepage.mode">
  <div>
    <xsl:apply-templates select="." mode="common.html.attributes"/>
    <xsl:call-template name="anchor"/>
    <xsl:if test="$abstract.notitle.enabled = 0">
      <h1 class="toc-title">
        <xsl:call-template name="gentext">
          <xsl:with-param name="key">Abstract</xsl:with-param>
        </xsl:call-template>
      </h1>
    </xsl:if>
    <xsl:apply-templates mode="titlepage.mode"/>
    <xsl:call-template name="process.footnotes"/>
  </div>
</xsl:template>

</xsl:stylesheet>
