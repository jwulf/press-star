<?xml version='1.0'?>
 
<!--
	Copyright 2012 Red Hat, Inc.
	License: GPL
	Author: Jeff Fearn <jfearn@redhat.com>
-->
<xsl:stylesheet version="1.0" xml:space="default" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output encoding="UTF-8" indent="no" method="html" omit-xml-declaration="yes" standalone="no" version="1.0"/>
<xsl:template match="/">
	<xsl:apply-templates select="//refsection"/>
</xsl:template>

<xsl:template match="refsection">
	<li><xsl:attribute name="class"><xsl:text>slider_item </xsl:text><xsl:value-of select="@role"/></xsl:attribute>
		<a><xsl:attribute name="class"><xsl:text>slider_link</xsl:text></xsl:attribute><xsl:attribute name="href"><xsl:copy-of select="literallayout"/></xsl:attribute>
		   <div class="slider_wrapper">
			<div class="slider_wrapper2">
				<div class="slider_title">
					<xsl:value-of select="title"/>
				</div>
				<div class="slider_body">
					<xsl:value-of select="subtitle"/>
				</div>
			</div>
		  </div>
		</a>
	</li>
</xsl:template>

</xsl:stylesheet>

