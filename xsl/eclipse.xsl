<?xml version='1.0'?>

<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns="http://www.w3.org/1999/xhtml"
				xmlns:exsl="http://exslt.org/common"
				version="1.0"
				exclude-result-prefixes="exsl">

<xsl:import href="http://docbook.sourceforge.net/release/xsl/current/eclipse/eclipse.xsl"/>
<xsl:import href="defaults.xsl"/>
<xsl:import href="xhtml-common.xsl"/>
<xsl:param name="chunker.output.omit-xml-declaration" select="'yes'"/>
<xsl:param name="chunker.output.doctype-public" select="''"/>
<xsl:param name="chunker.output.doctype-system" select="''"/>

<xsl:param name="suppress.navigation" select="1"/>

</xsl:stylesheet>
