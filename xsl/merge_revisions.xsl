<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
<xsl:output encoding="UTF-8" indent="yes" omit-xml-declaration="no" version="1.0"/>
<xsl:param name="trans_rev" select="''" />
<xsl:template match="/">
<xsl:variable name="trans_rev_doc" select="document($trans_rev)" />
<appendix>
<xsl:attribute name="id"><xsl:value-of select="(appendix/@id|appendix/@xml:id)[1]"/></xsl:attribute>
	<xsl:copy-of select="appendix/title"/>
	<simpara>
		<revhistory>
			<xsl:for-each select="/appendix/simpara/revhistory/revision|$trans_rev_doc/appendix/simpara/revhistory/revision">
				<xsl:sort select="./revnumber" order="descending"/>
				<xsl:copy-of select="."/>
			</xsl:for-each>
		</revhistory>
	</simpara>
</appendix>
</xsl:template>
</xsl:stylesheet>

