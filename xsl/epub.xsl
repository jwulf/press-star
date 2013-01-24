<?xml version='1.0'?>

<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns="http://www.w3.org/1999/xhtml"
				xmlns:exsl="http://exslt.org/common"
				version="1.0"
				exclude-result-prefixes="exsl">

<xsl:import href="http://docbook.sourceforge.net/release/xsl/current/epub/docbook.xsl"/>
<xsl:import href="defaults.xsl"/>
<xsl:import href="xhtml-common.xsl"/>
<xsl:param name="suppress.navigation" select="1"/>
<xsl:param name="tablecolumns.extensions" select="1"/>
<xsl:param name="epub.oebps.dir" select="'OEBPS/'"/> 

<!--xsl:param name="html.stylesheet" select="''"/-->

<xsl:param name="generate.toc">
set nop
book nop
article nop
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

<!-- Why is this spammed everywhere? It's not valid in most locations -->
<xsl:template name="generate.html.lang">
  <!--xsl:apply-templates select="." mode="html.lang.attribute"/-->
</xsl:template>

<!-- Added check for html.stylesheet.print -->
  <xsl:template name="opf.manifest">
    <xsl:element namespace="http://www.idpf.org/2007/opf" name="manifest">
      <xsl:element namespace="http://www.idpf.org/2007/opf" name="item">
        <xsl:attribute name="id"> <xsl:value-of select="$epub.ncx.toc.id"/> </xsl:attribute>
        <xsl:attribute name="media-type">application/x-dtbncx+xml</xsl:attribute>
        <xsl:attribute name="href"><xsl:value-of select="$epub.ncx.filename"/> </xsl:attribute>
      </xsl:element>

      <xsl:if test="contains($toc.params, 'toc')">
        <xsl:element namespace="http://www.idpf.org/2007/opf" name="item">
          <xsl:attribute name="id"> <xsl:value-of select="$epub.html.toc.id"/> </xsl:attribute>
          <xsl:attribute name="media-type">application/xhtml+xml</xsl:attribute>
          <xsl:attribute name="href">
            <xsl:call-template name="toc-href">
              <xsl:with-param name="node" select="/*"/>
            </xsl:call-template>
          </xsl:attribute>
        </xsl:element>
      </xsl:if>  

      <xsl:if test="$html.stylesheet != ''">
        <xsl:element namespace="http://www.idpf.org/2007/opf" name="item">
          <xsl:attribute name="media-type">text/css</xsl:attribute>
          <xsl:attribute name="id">css</xsl:attribute>
          <xsl:attribute name="href"><xsl:value-of select="$html.stylesheet"/></xsl:attribute>
        </xsl:element>
      </xsl:if>

      <xsl:if test="$html.stylesheet.print != ''">
        <xsl:element namespace="http://www.idpf.org/2007/opf" name="item">
          <xsl:attribute name="media-type">text/css</xsl:attribute>
          <xsl:attribute name="id">print-css</xsl:attribute>
          <xsl:attribute name="href"><xsl:value-of select="$html.stylesheet.print"/></xsl:attribute>
        </xsl:element>
      </xsl:if>

      <xsl:if test="/*/*[cover or contains(name(.), 'info')]//mediaobject[@role='cover' or ancestor::cover]"> 
        <xsl:element namespace="http://www.idpf.org/2007/opf" name="item">
          <xsl:attribute name="id"> <xsl:value-of select="$epub.cover.id"/> </xsl:attribute>
          <xsl:attribute name="href"> 
            <xsl:value-of select="$epub.cover.html"/>
          </xsl:attribute>
          <xsl:attribute name="media-type">application/xhtml+xml</xsl:attribute>
        </xsl:element>
      </xsl:if>  

      <xsl:choose>
        <xsl:when test="$epub.embedded.fonts != '' and not(contains($epub.embedded.fonts, ','))">
          <xsl:call-template name="embedded-font-item">
            <xsl:with-param name="font.file" select="$epub.embedded.fonts"/> <!-- There is just one -->
          </xsl:call-template>
        </xsl:when>
        <xsl:when test="$epub.embedded.fonts != ''">
          <xsl:variable name="font.file.tokens" select="str:tokenize($epub.embedded.fonts, ',')"/>
          <xsl:for-each select="exsl:node-set($font.file.tokens)">
            <xsl:call-template name="embedded-font-item">
              <xsl:with-param name="font.file" select="."/>
              <xsl:with-param name="font.order" select="position()"/>
            </xsl:call-template>
          </xsl:for-each>
        </xsl:when>
      </xsl:choose>

      <!-- TODO: be nice to have a id="titlepage" here -->
      <xsl:apply-templates select="//part|
                                   //book[*[last()][self::bookinfo]]|
                                   //book[bookinfo]|
                                   /set|
                                   /set/book|
                                   //reference|
                                   //preface|
                                   //chapter|
                                   //bibliography|
                                   //appendix|
                                   //article|
                                   //glossary|
                                   //section|
                                   //sect1|
                                   //sect2|
                                   //sect3|
                                   //sect4|
                                   //sect5|
                                   //refentry|
                                   //colophon|
                                   //bibliodiv[title]|
                                   //index|
                                   //setindex|
                                   //graphic|
                                   //inlinegraphic|
                                   //mediaobject|
                                   //mediaobjectco|
                                   //inlinemediaobject" 
                           mode="opf.manifest"/>
      <xsl:call-template name="opf.calloutlist"/>
    </xsl:element>
  </xsl:template>

  <xsl:template name="opf.calloutlist">
    <xsl:variable name="format">
      <xsl:call-template name="guess-media-type">
        <xsl:with-param name="ext" select="$callout.graphics.extension"/>
      </xsl:call-template>
    </xsl:variable>  
    <xsl:if test="(//calloutlist|//co)">
      <xsl:call-template name="opf.reference.callout">
        <xsl:with-param name="conum" select="1"/>
        <xsl:with-param name="format" select="$format"/>
      </xsl:call-template>
    </xsl:if>
  </xsl:template>


</xsl:stylesheet>
