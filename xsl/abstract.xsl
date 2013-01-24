<!-- Get abstract from Book_Info.xml -->
<xsl:stylesheet version="1.0" xml:space="preserve" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output encoding="UTF-8" indent="no" method="text" omit-xml-declaration="no" standalone="no" version="1.0"/>
<xsl:template match="/"><xsl:value-of select="/bookinfo/abstract"/><xsl:value-of select="/setinfo/abstract"/><xsl:value-of select="/articleinfo/abstract"/>
</xsl:template>
</xsl:stylesheet>
