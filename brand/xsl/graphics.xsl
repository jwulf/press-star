<?xml version='1.0'?> 
<xsl:stylesheet  
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
    
    <xsl:import href="http://docbook.sourceforge.net/release/xsl/current/xhtml/docbook.xsl"/>
    <xsl:import href="http://docbook.sourceforge.net/release/xsl/1.76.1/xhtml/graphics.xsl"/>
    <xsl:import href="../../../xsl/xhtml-common.xsl"/>

<xsl:template match="videodata">
  <xsl:call-template name="process.image">
    <xsl:with-param name="tag" select="'iframe'"/>
    <xsl:with-param name="alt">
      <xsl:apply-templates select="(../../textobject/phrase)[1]"/>
    </xsl:with-param>
  </xsl:call-template>
</xsl:template>

</xsl:stylesheet>
